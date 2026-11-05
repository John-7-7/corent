// Formatting for rents. The six sample listings that used to live here carried
// invented match scores (94%, 87%, 82%) and were only still imported for this
// one function — real listings come from services/listings.js and real scores
// from services/listingScoring.js.
export const formatRent = (rent) => `$${Number(rent).toLocaleString('en-SG')}`
