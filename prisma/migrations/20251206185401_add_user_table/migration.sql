/*
  Warnings:

  - You are about to drop the column `password` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[pseudo]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `hashedPassword` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pseudo` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "password",
ADD COLUMN     "hashedPassword" TEXT NOT NULL,
ADD COLUMN     "pseudo" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_pseudo_key" ON "User"("pseudo");
