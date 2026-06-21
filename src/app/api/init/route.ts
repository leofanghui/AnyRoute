export async function GET() {
  return Response.json({ initialized: true, profile: "minimal" });
}
