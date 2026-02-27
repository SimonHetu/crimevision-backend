import bcrypt from "bcrypt";
import prisma from "../prisma";

async function main() {
  const email = "admimi@mimi.com";
  const password = "Admimi123!";

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      role: "ADMIN",
      passwordHash,
      clerkId: null,
    },
    create: {
      email,
      role: "ADMIN",
      passwordHash,
      clerkId: null,
    },
    select: { id: true, email: true, role: true },
  });

  console.log("✅ Admin local prêt:");
  console.log(user);
  console.log("Password:", password);
}

main()
  .catch((e) => {
    console.error("❌ seedAdmin error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });