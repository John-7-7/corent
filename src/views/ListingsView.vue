<script setup>
// TODO: fetch and display house listings
import AppIcon from '@/components/AppIcon.vue'

// Static sample data only. Replace with your listings and scores later.
const listings = [
  { id: 1, title: 'Clementi Ave 2 Condo', price: '$2,800', area: 'Clementi', type: 'Condo', beds: 3, from: '1 Dec 2026', match: 94, tone: '', saved: true, available: true },
  { id: 2, title: 'Tampines St 86 HDB', price: '$2,200', area: 'Tampines', type: 'HDB', beds: 4, from: '15 Dec 2026', match: 87, tone: 'alt', saved: false, available: true },
  { id: 3, title: 'Queenstown Lane Condo', price: '$3,100', area: 'Queenstown', type: 'Condo', beds: 3, from: '1 Jan 2027', match: 82, tone: 'cool', saved: false, available: true },
  { id: 4, title: 'Bishan St 22 HDB', price: '$2,450', area: 'Bishan', type: 'HDB', beds: 3, from: 'Not listed', match: 68, tone: 'alt', saved: false, available: true },
  { id: 5, title: 'Jurong East Ave 1 Condo', price: '$2,900', area: 'Jurong', type: 'Condo', beds: 4, from: '1 Feb 2027', match: 55, tone: 'cool', saved: false, available: false },
  { id: 6, title: 'Punggol Field HDB', price: '$2,100', area: 'Punggol', type: 'HDB', beds: 4, from: '1 Dec 2026', match: 49, tone: '', saved: false, available: true },
]

const breakdown = [
  { label: 'Budget', detail: '$933 each across 3 (limit $1,100)', status: 'met' },
  { label: 'Area', detail: 'Clementi', status: 'met' },
  { label: 'Commute', detail: 'About 40 min (limit 30)', status: 'unmet' },
  { label: 'Move-in date', detail: 'Availability date not listed', status: 'unknown' },
  { label: 'Bedrooms', detail: '3 bedrooms (need 3)', status: 'met' },
  { label: 'Amenities', detail: 'Has everything wanted', status: 'met' },
]
const statusText = { met: 'Met', unmet: 'Not met', unknown: 'Insufficient data' }
const statusClass = { met: 'tag-ok', unmet: 'tag-red', unknown: 'tag-warn' }

// Set to true to preview the property details dialog.
const showDetails = false
</script>

<template>
  <div>
    <header class="page-head">
      <h1>Browse</h1>
      <p>Listings scored against your preferences</p>
    </header>

    <div class="content">
      <div class="stack-wide">
        <!-- Browsing as + filters -->
        <section class="card" aria-label="Filters">
          <div class="between wrap">
            <div class="segmented" role="group" aria-label="Browse as">
              <button type="button" aria-pressed="false">Just me</button>
              <button type="button" class="on" aria-pressed="true">Flat Hunt 2025</button>
            </div>
            <p class="small muted">Scores use your group's combined preferences.</p>
          </div>

          <div class="filters">
            <div class="field">
              <label for="f-area">Area</label>
              <select id="f-area" class="input"><option>Any</option><option>Clementi</option><option>Tampines</option></select>
            </div>
            <div class="field">
              <label for="f-type">Type</label>
              <select id="f-type" class="input"><option>Any</option><option>HDB</option><option>Condo</option><option>Landed</option></select>
            </div>
            <div class="field">
              <label for="f-beds">Bedrooms</label>
              <select id="f-beds" class="input"><option>Any</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5 or more</option></select>
            </div>
            <div class="field">
              <label for="f-rent">Max rent</label>
              <input id="f-rent" class="input" type="number" placeholder="$ / month" />
            </div>
            <div class="field">
              <label for="f-sort">Sort by</label>
              <select id="f-sort" class="input"><option>Best match</option><option>Newest</option><option>Rent: low to high</option><option>Rent: high to low</option></select>
            </div>
          </div>
        </section>

        <div class="between">
          <p class="small muted">6 listings</p>
          <button class="link" type="button">Clear filters</button>
        </div>

        <!-- Listing grid -->
        <div class="listing-grid">
          <article v-for="l in listings" :key="l.id" class="listing" :class="{ gone: !l.available }">
            <div class="listing-img thumb" :class="l.tone">
              <span v-if="l.available" class="pill badge">{{ l.match }}% match</span>
              <span v-else class="tag badge">Unavailable</span>
              <button
                class="save-btn"
                :class="{ saved: l.saved }"
                type="button"
                :aria-pressed="l.saved"
                :aria-label="l.saved ? 'Remove from shortlist' : 'Add to shortlist'"
              >
                <AppIcon name="bookmark" :size="15" :fill="l.saved" />
              </button>
            </div>

            <div class="listing-body">
              <h3>{{ l.title }}</h3>
              <p class="price">{{ l.price }}<span class="muted">/mo</span></p>
              <p class="small muted row-inline"><AppIcon name="pin" :size="11" /> {{ l.area }}</p>
              <p class="small muted">{{ l.type }} · {{ l.beds }} bedrooms · From {{ l.from }}</p>

              <div class="row actions">
                <button class="btn btn-sm" type="button" style="flex: 1">View details</button>
                <button
                  class="btn btn-sm"
                  :class="{ 'btn-primary': !l.saved }"
                  type="button"
                  :disabled="!l.available && !l.saved"
                  style="flex: 1"
                >
                  {{ l.saved ? 'Remove' : 'Add to shortlist' }}
                </button>
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>

    <!-- Property details dialog -->
    <div v-if="showDetails" class="modal-backdrop">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <div class="between" style="align-items: flex-start">
          <div>
            <h2 id="detail-title" style="font-size: 17px">Clementi Ave 2 Condo</h2>
            <p class="small muted row-inline" style="margin-top: 2px">
              <AppIcon name="pin" :size="11" /> Clementi · Condo · 3 bedrooms
            </p>
          </div>
          <button class="icon-btn" type="button" aria-label="Close details"><AppIcon name="x" :size="16" /></button>
        </div>

        <div class="between" style="margin: 0.9rem 0">
          <p class="price big">$2,800<span class="muted">/mo</span></p>
          <div class="row">
            <span class="tag tag-ok">Available</span>
            <span class="pill">94% match</span>
          </div>
        </div>

        <h3>Amenities</h3>
        <div class="chips" style="margin-bottom: 1rem">
          <span class="tag">WiFi</span><span class="tag">Aircon</span><span class="tag">Gym</span><span class="tag">Pool</span>
        </div>

        <h3>How it fits your group</h3>
        <ul class="breakdown">
          <li v-for="b in breakdown" :key="b.label">
            <span class="tag" :class="statusClass[b.status]">{{ statusText[b.status] }}</span>
            <strong>{{ b.label }}</strong>
            <span class="small muted">{{ b.detail }}</span>
          </li>
        </ul>

        <p class="small" style="margin: 0.9rem 0">
          <a class="link" href="#" target="_blank" rel="noopener noreferrer">View the original listing</a>
        </p>

        <div class="row" style="justify-content: flex-end">
          <button class="btn btn-primary" type="button">Add to shortlist</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wrap { flex-wrap: wrap; }
.row-inline { display: inline-flex; align-items: center; gap: 0.25rem; }
.filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 0 0.75rem;
  margin-top: 1rem;
}
.filters .field { margin-bottom: 0; }

.listing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 0.9rem;
}
.listing {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
}
.listing.gone { opacity: 0.8; }
.listing-img { position: relative; height: 140px; }
.badge { position: absolute; top: 10px; left: 10px; background: #fff; }
.save-btn {
  position: absolute; top: 8px; right: 8px; display: grid; place-items: center;
  width: 30px; height: 30px; border-radius: 50%; border: 0; background: #fff;
  color: var(--muted); cursor: pointer; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}
.save-btn.saved { color: var(--red); }
.listing-body { padding: 0.8rem; display: grid; gap: 3px; flex: 1; align-content: start; }
.price { color: var(--red); font-weight: 700; font-size: 14px; }
.price span { font-weight: 400; font-size: 11px; }
.price.big { font-size: 22px; }
.price.big span { font-size: 12px; }
.actions { margin-top: 0.6rem; }

.breakdown { list-style: none; padding: 0; margin: 0.6rem 0 0; display: grid; gap: 0.55rem; }
.breakdown li { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.2rem 0.6rem; font-size: 13px; }
</style>