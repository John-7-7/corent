import listingsData from '../data/listings.json'
// import { db } from '../firebase'
// import { collection, getDocs, query, where } from 'firebase/firestore'

// Flip to false once Housing_Listing is seeded. Nothing else in the app changes.
const USE_LOCAL = true

export async function getListings() {
  if (USE_LOCAL) return listingsData
  // const snap = await getDocs(
  //   query(collection(db, 'Housing_Listing'), where('IsAvailable', '==', true)),
  // )
  // return snap.docs.map((d) => ({ ListingID: d.id, ...d.data() }))
}

export async function getListingById(id) {
  const all = await getListings()
  return all.find((l) => l.ListingID === id) ?? null
}
