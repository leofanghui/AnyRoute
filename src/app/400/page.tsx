import ErrorPageScaffold from "@/shared/components/ErrorPageScaffold";

export default function BadRequestPage() {
  return (
    <ErrorPageScaffold
      code="400"
      icon="rule"
      title="Bad Request"
      description="The request payload is invalid or incomplete."
      suggestions={[
        "Review required fields and payload format before retrying.",
        "If you are using the API, validate the JSON schema locally.",
        "If this keeps happening, inspect the request body and retry against the minimal API endpoint.",
      ]}
      primaryAction={{ href: "/docs", label: "Open Documentation" }}
      secondaryAction={{ href: "/dashboard/endpoint", label: "Open Endpoint" }}
    />
  );
}
