export const CURRENCY_SYMBOL = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD"
})
  .formatToParts(0)
  .find((part) => part.type === "currency")?.value || "";
