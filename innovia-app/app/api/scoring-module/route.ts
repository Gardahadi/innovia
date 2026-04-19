import { NextRequest } from "next/server";

// TODO: replace with real internal scoring module API call

export async function POST(_request: NextRequest) {
  try {
    // Mock scoring signals — hardcoded realistic values
    const mockSignal = {
      marketSignal: 72,
      teamSignal: 68,
      tractionSignal: 81,
      recommendation:
        "Moderate conviction. Traction metrics are strong for the stage; team domain expertise warrants deeper diligence before advancing.",
    };

    return Response.json(mockSignal);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
