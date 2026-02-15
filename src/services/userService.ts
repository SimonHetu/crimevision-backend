import prisma from "../prisma"

export async function ensureUserFromClerk(
  clerkId: string,
  email: string | null
) {
  return prisma.user.upsert({
    where: { clerkId },
    update: { email },
    create: {
      clerkId,
      email
    },
  })
}
