// BSR to estimated monthly sales calculation
// Based on Kindlepreneur's estimation model
export const estimateMonthlySales = (bsr: number): number => {
  // Coefficients for the estimation formula
  // These are approximations based on industry data
  if (bsr <= 1) return 6000;
  if (bsr <= 5) return 3000;
  if (bsr <= 20) return 2000;
  if (bsr <= 50) return 1000;
  if (bsr <= 100) return 500;
  if (bsr <= 1000) return Math.round(450 * Math.pow(bsr / 100, -0.3));
  if (bsr <= 10000) return Math.round(200 * Math.pow(bsr / 1000, -0.3));
  if (bsr <= 100000) return Math.round(80 * Math.pow(bsr / 10000, -0.3));
  return Math.round(10 * Math.pow(bsr / 100000, -0.3));
};

// Format sales number with appropriate suffix (K, M)
export const formatSales = (sales: number): string => {
  if (sales >= 1000000) {
    return `${(sales / 1000000).toFixed(1)}M`;
  }
  if (sales >= 1000) {
    return `${(sales / 1000).toFixed(1)}K`;
  }
  return sales.toString();
}; 