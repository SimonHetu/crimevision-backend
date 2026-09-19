import prisma from "../prisma";

export async function getOrCreateUserByClerkId(
  clerkId: string,
  email?: string | null
) {
  return prisma.user.upsert({

    where: { clerkId },

    update: {
      ...(email ? { email } : {}),
    },
    create: {
      clerkId,
      email: email ?? null,

      profile: { create: {} },
    },
    
    include: { profile: true },
  });
}
