// BSR to estimated monthly sales calculation
// Algorithm derived from Kindlepreneur's BSR calculator (piecewise linear interpolation)
// Source: kindlepreneur.com/amazon-kdp-sales-rank-calculator
// Returns daily sales for physical books (paperback/hardcover), multiplied by 30 for monthly.

function dailySalesFromBsr(bsr: number): number {
  if (!bsr || bsr <= 0) return 0;
  const x = bsr;
  let books = 0;

  if (x >= 1     && x <= 5)      books = ((2475 - 1350) / 5)           * (5      - x) + 1350;
  else if (x <= 20)              books = ((1250 - 720)  / (20  - 5))   * (20     - x) + 720;
  else if (x <= 35)              books = ((700  - 535)  / (35  - 20))  * (35     - x) + 535;
  else if (x <= 100)             books = ((530  - 300)  / (100 - 35))  * (100    - x) + 300;
  else if (x <= 200)             books = ((300  - 200)  / (200 - 100)) * (200    - x) + 200;
  else if (x <= 350)             books = ((200  - 140)  / (350 - 200)) * (350    - x) + 140;
  else if (x <= 500)             books = ((138  - 110)  / (500 - 350)) * (500    - x) + 110;
  else if (x <= 750)             books = ((108  - 84)   / (750 - 500)) * (750    - x) + 84;
  else if (x <= 1500)            books = ((83   - 50)   / (1500 - 750))  * (1500 - x) + 50;
  else if (x <= 3000)            books = ((49   - 30)   / (3000 - 1500)) * (3000 - x) + 30;
  else if (x <= 5500)            books = ((30   - 20)   / (5500 - 3000)) * (5500 - x) + 20;
  else if (x <= 10000)           books = ((20   - 12)   / (10000 - 5500))  * (10000 - x) + 12;
  else if (x <= 50000)           books = ((12   - 3)    / (50000 - 10000)) * (50000 - x) + 3;
  else if (x <= 100000)          books = ((3    - 1)    / (100000 - 50000)) * (100000 - x) + 1;
  else                           books = 100000 / (100000 + (x - 100000) * 8);

  return books;
}

export function estimateMonthlySales(bsr: number): number {
  return Math.round(dailySalesFromBsr(bsr) * 30);
}

export function formatSales(sales: number, bsr?: number): string {
  if (bsr && bsr > 100000) return '< 30';
  if (sales >= 1_000_000) return `${(sales / 1_000_000).toFixed(1)}M`;
  if (sales >= 1_000)     return `${(sales / 1_000).toFixed(1)}K`;
  return sales.toString();
}
