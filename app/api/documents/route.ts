import { type NextRequest, NextResponse } from "next/server"

// Simple in-memory storage for demo purposes
const documents = [
  {
    id: "1",
    name: "Sample Document.pdf",
    size: "2.4 MB",
    modified: "2 hours ago",
    type: "pdf",
    status: "ready" as const,
    userId: "1",
  },
  {
    id: "2",
    name: "Project Proposal.pdf",
    size: "1.8 MB",
    modified: "1 day ago",
    type: "pdf",
    status: "ready" as const,
    userId: "1",
  },
  {
    id: "3",
    name: "Contract Draft.pdf",
    size: "3.2 MB",
    modified: "3 days ago",
    type: "pdf",
    status: "processing" as const,
    userId: "1",
  },
]

export async function GET(request: NextRequest) {
  try {
    // In production, extract user ID from JWT token
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Return user's documents
    return NextResponse.json({
      documents: documents,
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 })
  }
}
