-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "paymentRef" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Booking_paymentRef_key" ON "Booking"("paymentRef");
