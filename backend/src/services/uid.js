// ─────────────────────────────────────────────────────────────────────────────
// YAGONA ID GENERATORI (backend) — frontend dagi uid() bilan bir xil qoida.
//
// Date.now() bir millisekundda bir necha marta chaqirilsa BIR XIL qiymat
// qaytaradi. Bot orqali ikki mijoz bir vaqtda zakaz bersa yoki haydovchi
// ketma-ket ikki reys yuborsa — yozuvlar bir xil id bilan yaratilardi.
// Frontend esa ularni id bo'yicha filtrlaydi (`existing.has(o.id)`), ya'ni
// ikkinchisi jimgina tashlab ketilardi.
//
// uid() har chaqiruvda qat'iy o'suvchi va takrorlanmas son qaytaradi.
// ─────────────────────────────────────────────────────────────────────────────
let _last = 0;

function uid() {
  const now = Date.now();
  _last = now > _last ? now : _last + 1;
  return _last;
}

module.exports = { uid };
