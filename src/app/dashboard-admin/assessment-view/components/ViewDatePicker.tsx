"use client";

import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

export default function ViewDatePicker({ date }: { date: Date | null }) {
    return (
        <DatePicker
            dateFormat="dd/MM/yyyy"
            selected={date}
            disabled
            placeholderText="วว/ดด/ปปปป"
            wrapperClassName="w-full"
            className="w-full bg-gray-100 border border-gray-300 text-gray-500 text-sm rounded-xl block p-3 shadow-sm cursor-not-allowed"
        />
    );
}
