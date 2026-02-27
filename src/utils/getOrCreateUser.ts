import prisma from "../prisma";

// Fonction utilitaire qui garantit qu’un User existe en base
// à partir de son clerkId (provenant de l’auth Clerk).
// Si l’utilisateur existe → update (email si fourni).
// Sinon → création + création automatique d’un UserProfile lié.

export async function getOrCreateUserByClerkId(
  clerkId: string,
  email?: string | null
) {
  return prisma.user.upsert({

    // On cherche un user unique via clerkId
    where: { clerkId },

    // Si trouvé → on met à jour l’email uniquement s’il est fourni
    update: {
      ...(email ? { email } : {}),
    },
    create: {
      clerkId,
      email: email ?? null,

      // Création automatique du profil lié (relation 1-1)
      profile: { create: {} },
    },
    
    // On retourne aussi le profile avec le user
    include: { profile: true },
  });
}
