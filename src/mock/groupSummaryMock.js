// Fictional demo group for F-REQ-010 to 013, shown at /group-summary (no group ID).
// Nothing here is saved to Firebase; /group-summary/:groupId loads real data.
// Preview the page as Ben. Only this viewer's private budget is loaded separately.
// Later use Firebase Auth's UID and that user's own Private/Budget document.
export const mockViewer = {
  uid: 'mock-ben',
  privateBudget: { BudgetMin: 1200, BudgetMax: 1700 },
}

export const mockGroup = {
  GroupID: 'mock-group-1',
  GroupName: 'Flat Hunt 2027',
  Members: ['mock-alice', 'mock-ben', 'mock-chris', 'mock-diana'],
}

// Names belong to users, separate from their User_Preferences documents.
export const mockUsers = [
  { UserID: 'mock-alice', Username: 'Alice' },
  { UserID: 'mock-ben', Username: 'Ben' },
  { UserID: 'mock-chris', Username: 'Chris' },
  { UserID: 'mock-diana', Username: 'Diana' },
]

// Public profile fields match the existing profile form. Dates stay YYYY-MM-DD;
// locations and amenities use the slugs already used by preferenceOptions.js.
// CreatedAt/UpdatedAt are omitted because this preview does not save documents.
// The group is deliberately hard to please, to exercise every case:
//   - budgets: Alice and Chris don't overlap at all; Ben's is private
//   - commute: Chris commutes to Tampines, far from NUS and SMU
//   - bedrooms: Chris wants 2, Alice and Diana want 3–4, Ben is "Any"
//   - move-in: Chris wants April, everyone else January
//   - smoking: Chris smokes, Alice wants non-smoking only (opposites)
//   - guests: Ben welcomes guests, Chris wants none (opposites)
//   - co-tenants: Chris expects a household of 2 in a group of 4
export const mockProfiles = [
  {
    UserID: 'mock-alice',
    IsBudgetPrivate: false,
    BudgetMin: 1500,
    BudgetMax: 2200,
    MaxCommuteTime: 30,
    CommuteDestination: { Address: 'NUS, Kent Ridge', Lat: 1.2966, Lng: 103.7764 },
    BedroomsMin: 3,
    BedroomsMax: 4,
    PreferredMoveInDate: '2027-01-01',
    PropertyType: 'HDB',
    LeaseDuration: '12',
    CoTenants: 3,
    FurnishingLevel: 'Full',
    CookingAccess: 'Required',
    AirconCoverage: 'AllRooms',
    SmokingPreference: 'NonSmoking',
    StudyEnvironment: 'Quiet',
    GuestPolicy: 'Limited',
    Amenities: ['wifi', 'aircon', 'laundry'],
    PreferredLocations: ['clementi', 'queenstown'],
  },
  {
    UserID: 'mock-ben',
    IsBudgetPrivate: true,
    BudgetMin: null,
    BudgetMax: null,
    MaxCommuteTime: 45,
    CommuteDestination: { Address: 'SMU, Victoria Street', Lat: 1.2968, Lng: 103.8502 },
    BedroomsMin: null,
    BedroomsMax: null,
    PreferredMoveInDate: '2027-01-15',
    PropertyType: 'Any',
    LeaseDuration: 'Flexible',
    CoTenants: 3,
    FurnishingLevel: 'Any',
    CookingAccess: 'NoPreference',
    AirconCoverage: 'CommonOnly',
    SmokingPreference: 'NoPreference',
    StudyEnvironment: 'Sociable',
    GuestPolicy: 'Welcome',
    Amenities: ['wifi', 'gym'],
    PreferredLocations: [],
  },
  {
    UserID: 'mock-chris',
    IsBudgetPrivate: false,
    BudgetMin: 2600,
    BudgetMax: 3500,
    MaxCommuteTime: 20,
    CommuteDestination: { Address: 'Tampines Hub', Lat: 1.3532, Lng: 103.9405 },
    BedroomsMin: 2,
    BedroomsMax: 2,
    PreferredMoveInDate: '2027-04-01',
    PropertyType: 'Condo',
    LeaseDuration: '24',
    CoTenants: 1,
    FurnishingLevel: 'Partial',
    CookingAccess: 'NotNeeded',
    AirconCoverage: 'AllRooms',
    SmokingPreference: 'Allowed',
    StudyEnvironment: 'Sociable',
    GuestPolicy: 'NoGuests',
    Amenities: ['pool', 'parking'],
    PreferredLocations: ['tampines', 'bishan'],
  },
  {
    UserID: 'mock-diana',
    IsBudgetPrivate: false,
    BudgetMin: 1800,
    BudgetMax: 2700,
    MaxCommuteTime: 35,
    CommuteDestination: { Address: 'NUS, Kent Ridge', Lat: 1.2966, Lng: 103.7764 },
    BedroomsMin: 3,
    BedroomsMax: 4,
    PreferredMoveInDate: '2027-01-20',
    PropertyType: 'Any',
    LeaseDuration: '12',
    CoTenants: 3,
    FurnishingLevel: 'Full',
    CookingAccess: 'Required',
    AirconCoverage: 'AllRooms',
    SmokingPreference: 'NoPreference',
    StudyEnvironment: 'Quiet',
    GuestPolicy: 'Limited',
    Amenities: ['wifi', 'aircon'],
    PreferredLocations: ['queenstown', 'clementi'],
  },
]

// Sample ballots from the other members, so the viewer's vote completes the
// round and Finalise can be tried. Budget ballots are a per-person maximum.
export const mockVotes = {
  budget: { 'mock-alice': 2200, 'mock-chris': 2800, 'mock-diana': 2600 },
  PropertyType: { 'mock-alice': 'HDB', 'mock-chris': 'Condo', 'mock-diana': 'HDB' },
  bedrooms: { 'mock-alice': 3, 'mock-chris': 2, 'mock-diana': 3 },
}
