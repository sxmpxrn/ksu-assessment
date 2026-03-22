import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const supabase = createClient(cookieStore);

        // 1. Validate Custom Session
        const sessionToken = cookieStore.get("session_token")?.value;
        if (!sessionToken) {
             return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const { data: sessionData } = await supabase
            .from("user_sessions")
            .select("role")
            .eq("session_token_hash", sessionToken)
            .gt("expires_at", new Date().toISOString())
            .single();
        if (!sessionData) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const payload = await request.json();
        const { headPayloads, detailPayloads } = payload;

        if (!headPayloads || headPayloads.length === 0) {
            return NextResponse.json({ error: "No head data to insert" }, { status: 400 });
        }

        // 2. Insert Head
        const { error: errorH } = await supabase
            .from("assessment_head")
            .insert(headPayloads);

        if (errorH) {
            return NextResponse.json({ error: errorH.message, code: errorH.code }, { status: 400 });
        }

        // 3. Insert Details
        if (detailPayloads && detailPayloads.length > 0) {
            const { error: errorD } = await supabase
                .from("assessment_detail")
                .insert(detailPayloads);

            if (errorD) {
                return NextResponse.json({ error: errorD.message, code: errorD.code }, { status: 400 });
            }
        }

        return NextResponse.json({ success: true }, { status: 200 });

    } catch (error: any) {
        console.error("API Error creating assessment:", error);
        return NextResponse.json(
            { error: error?.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}
