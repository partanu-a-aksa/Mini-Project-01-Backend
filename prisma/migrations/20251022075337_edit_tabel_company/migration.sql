/*
  Warnings:

  - You are about to drop the column `email` on the `Organizer` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `Organizer` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `Organizer` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[emailOrg]` on the table `Organizer` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `emailOrg` to the `Organizer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `passwordOrg` to the `Organizer` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."Organizer_email_key";

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "profPic" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Organizer" DROP COLUMN "email",
DROP COLUMN "password",
DROP COLUMN "phone",
ADD COLUMN     "emailOrg" TEXT NOT NULL,
ADD COLUMN     "passwordOrg" TEXT NOT NULL,
ADD COLUMN     "phoneOrg" TEXT,
ALTER COLUMN "updatedAt" DROP NOT NULL,
ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "Organizer_emailOrg_key" ON "Organizer"("emailOrg");
