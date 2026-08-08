// ─────────────────────────────────────────────────────────────────────────────
// Haydovchi hisob-kitobi — bitta joyda.
//
// Haydovchiga pul ikki yo'l bilan beriladi:
//   1) Haydovchilar bo'limidan "to'lov" reysi (driverTrips, isPayment: true)
//   2) Kassirdan to'g'ridan-to'g'ri chiqim (kassa yozuvida mijoz o'rniga
//      haydovchi ismi yoziladi)
// Balans = ishlagani − berilgani.
//
// Bu hisob uch joyda (Haydovchilar, Hisobotlar, Umumiy hisobot) qo'lda
// takrorlanardi — biri o'zgarsa boshqasi eskirib qolardi. Endi bitta manba.
//
// NOZIK JOY: kassa yozuvida customerId bo'lsa — u mijozlar bazasidagi odamga
// biriktirilgan, ya'ni haydovchiga tegishli EMAS. Bir xil nomli mijoz va
// haydovchi bo'lganda, mijozga qilingan to'lov haydovchi balansidan
// ayirilib ketardi.
// ─────────────────────────────────────────────────────────────────────────────
import { sameName } from './customerRef.js';

const num = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };

/**
 * @param {object} driver — { id, name }
 * @param {object} data   — { driverTrips, cashRows, bankRows, clickRows }
 * @returns {{ earnings, tripPaid, kassiPaid, totalPaid, balance, tripsCount }}
 *   balans musbat = haydovchiga to'lanishi kerak
 *   balans manfiy = haydovchi avans qarzdor
 */
export function driverBalance(driver, data = {}) {
  const { driverTrips = [], cashRows = [], bankRows = [], clickRows = [] } = data;
  if (!driver) return { earnings: 0, tripPaid: 0, kassiPaid: 0, totalPaid: 0, balance: 0, tripsCount: 0 };

  const trips = driverTrips.filter(t => t && t.driverId === driver.id);
  const earnings = trips.filter(t => !t.isPayment).reduce((s, t) => s + num(t.price), 0);
  const tripPaid = trips.filter(t =>  t.isPayment).reduce((s, t) => s + num(t.price), 0);

  const kassiPaid = [...cashRows, ...bankRows, ...clickRows]
    .filter(r => r && !r.auto && r.customerId == null && sameName(r.customer, driver.name) && num(r.amount) < 0)
    .reduce((s, r) => s + Math.abs(num(r.amount)), 0);

  const totalPaid = tripPaid + kassiPaid;
  return {
    earnings, tripPaid, kassiPaid, totalPaid,
    balance: earnings - totalPaid,
    tripsCount: trips.filter(t => !t.isPayment).length,
  };
}

// Barcha haydovchilarga to'lanishi kerak bo'lgan jami summa.
// Manfiy balans (haydovchi avans qarzdor) qo'shilmaydi — u bizning
// qarzimiz emas, aksincha.
export function totalDriverDebt(drivers, data) {
  return (drivers || []).reduce((s, d) => s + Math.max(0, driverBalance(d, data).balance), 0);
}
