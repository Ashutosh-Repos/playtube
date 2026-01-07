"use client";

import JsonView from "react18-json-view";
import "react18-json-view/src/style.css";

export default function ClientJson({ data }: { data: any }) {
  return <JsonView src={data} />;
}