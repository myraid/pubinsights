/**
 * Estimates daily sales based on Amazon Best Seller Rank (BSR)
 * @param bsr The Best Seller Rank of the product
 * @returns Estimated daily sales
 */
export function estimateDailySales(bsr: number): number {
    if (bsr <= 0) return 0;
    return 1 / Math.pow(bsr, 0.5);
}

/**
 * Estimates monthly sales based on Amazon Best Seller Rank (BSR)
 * @param bsr The Best Seller Rank of the product
 * @returns Estimated monthly sales
 */
export function estimateMonthlySales(bsr: number): number {
    return estimateDailySales(bsr) * 30;
}

/**
 * Formats sales estimate with appropriate rounding
 * @param sales The sales number to format
 * @returns Formatted sales number with 2 decimal places
 */
export function formatSalesEstimate(sales: number): string {
    return sales.toFixed(2);
}

/**
 * Gets sales estimate category based on BSR
 * @param bsr The Best Seller Rank of the product
 * @returns Category of sales performance
 */
export function getSalesCategory(bsr: number): string {
    if (bsr <= 1000) return "Very High";
    if (bsr <= 5000) return "High";
    if (bsr <= 10000) return "Medium";
    if (bsr <= 50000) return "Low";
    return "Very Low";
} 