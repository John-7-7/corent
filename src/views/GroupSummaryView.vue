<template>
  <section class="summary-page">
    <header class="page-header">
      <h1>Group Summary</h1>
      <p>Review your shared preferences and view group compatibility</p>
    </header>

    <div class="summary-grid">
      <div class="column">
        <section class="card alignment-card">
          <h2>Group alignment</h2>

          <div class="alignment-content">
            <div class="alignment-circle">
              <span>—</span>
            </div>

            <!-- view group competibilty score --> 
            <div>
              <h3>Overall compatibility</h3>
              <p class="muted">
                View your group's preference alignment
              </p>
            </div>
          </div>
        </section>

        <section class="card">
          <h2>Group preferences</h2>
          <p class="section-description">
            Your shared housing requirements at a glance.
          </p>

          <dl class="preference-list">
            <div>
              <dt>Monthly budget</dt>
              <dd>—</dd> // dashes need to be replaced later
            </div>
            <div>
              <dt>Commute time</dt>
              <dd>—</dd>
            </div>
            <div>
              <dt>Bedrooms</dt>
              <dd>—</dd>
            </div>
            <div>
              <dt>Move-in date</dt>
              <dd>—</dd>
            </div>
            <div>
              <dt>Property type</dt>
              <dd>—</dd>
            </div>
            <div>
              <dt>Preferred locations</dt>
              <dd>—</dd>
            </div>
          </dl>
        </section>

        <!--group member information--> 
        <section class="card">
          <h2>Members</h2>
          <div class="empty-area">
            Group members will appear here.
          </div>
        </section>

        <!-- conflict management --> 
        <section class="card">
          <h2>Preferences to discuss</h2>
          <p class="section-description">
            Identify differences and decide where your group can compromise.
          </p>

          <div class="notice">
            Preference conflicts will appear after the group's preferences
            have been analysed.
          </div>
        </section>
      </div>

      <div class="column">
        // preference comparison visualisations (added for further analytics)
        <section class="card">
          <h2>Preference alignment</h2>
          <p class="section-description">
            Compare requirements across group members.
          </p>

          <div class="chart-area">
            <span>Preference comparison chart</span>
            <small>Waiting for group preference data</small>
          </div>
        </section>

        <!-- support levels-->
        <section class="card">
          <h2>Preference support</h2>
          <p class="section-description">
            See how strongly members support each requirement.
          </p>

          <div class="support-list">
            <div class="support-item">
              <div class="support-label">
                <span>Budget</span>
                <span>—</span>
              </div>
              <div class="support-track" aria-hidden="true"></div>
            </div>

            <div class="support-item">
              <div class="support-label">
                <span>Commute</span>
                <span>—</span>
              </div>
              <div class="support-track" aria-hidden="true"></div>
            </div>

            <div class="support-item">
              <div class="support-label">
                <span>Bedrooms</span>
                <span>—</span>
              </div>
              <div class="support-track" aria-hidden="true"></div>
            </div>

            <div class="support-item">
              <div class="support-label">
                <span>Location</span>
                <span>—</span>
              </div>
              <div class="support-track" aria-hidden="true"></div>
            </div>

            <div class="support-item">
              <div class="support-label">
                <span>Amenities</span>
                <span>—</span>
              </div>
              <div class="support-track" aria-hidden="true"></div>
            </div>
          </div>
        </section>

        <!-- priority control -->
        <section class="card">
          <h2>Set group priorities</h2>
          <p class="section-description">
            Decide which requirements matter most to your group.
          </p>

          <fieldset class="priority-fields" disabled>
            <legend class="sr-only">Group requirement priorities</legend>

            <label class="priority-row">
              <span>Budget</span>
              <select>
                <option value="">Select priority</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>

            <label class="priority-row">
              <span>Commute</span>
              <select>
                <option value="">Select priority</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>

            <label class="priority-row">
              <span>Bedrooms</span>
              <select>
                <option value="">Select priority</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>

            <label class="priority-row">
              <span>Location</span>
              <select>
                <option value="">Select priority</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>

            <label class="priority-row">
              <span>Amenities</span>
              <select>
                <option value="">Select priority</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
          </fieldset>

          <p class="implementation-note">
            Priority editing is not connected yet.
          </p>
        </section>
      </div>
    </div>

    <!-- preserve selected group - this one to rethink thru later --> 
    <footer class="page-actions">
      <RouterLink to="/listings" class="primary-button">
        Browse rental listings
      </RouterLink>
    </footer>
  </section>
</template>

<style scoped>
.summary-page {
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  padding: 32px 24px;
  box-sizing: border-box;
  color: var(--text, #242424);
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  margin: 0 0 8px;
  font-size: 26px;
}

.page-header p,
.section-description,
.muted {
  margin: 0;
  color: #737373;
  font-size: 13px;
  line-height: 1.6;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}

.column {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 20px;
}

.card {
  padding: 24px;
  border: 1px solid var(--line, #e9e9e9);
  border-radius: 14px;
  background: #fff;
}

.card h2 {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 700;
}

.alignment-content {
  display: flex;
  align-items: center;
  gap: 18px;
  margin-top: 20px;
}

.alignment-content h3 {
  margin: 0 0 6px;
  font-size: 16px;
}

.alignment-circle {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 82px;
  height: 82px;
  box-sizing: border-box;
  border: 7px solid var(--red-tint, #fff0f3);
  border-radius: 50%;
  color: var(--red, #ed003b);
  font-size: 25px;
  font-weight: 700;
}

.preference-list {
  margin: 16px 0 0;
}

.preference-list > div {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  padding: 11px 0;
  border-bottom: 1px solid var(--line, #e9e9e9);
  font-size: 13px;
}

.preference-list > div:last-child {
  border-bottom: 0;
}

.preference-list dt {
  color: #737373;
}

.preference-list dd {
  margin: 0;
  text-align: right;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.empty-area,
.notice {
  padding: 18px;
  border-radius: 9px;
  font-size: 12px;
  line-height: 1.6;
}

.empty-area {
  background: #fafafa;
  color: #737373;
}

.notice {
  margin-top: 16px;
  border: 1px solid #f0dfbb;
  background: #fffaf0;
  color: #795b23;
}

/* space for comparison chart (for further analytics if we need later)*/
.chart-area {
  display: flex;
  min-height: 230px;
  margin-top: 18px;
  padding: 20px;
  box-sizing: border-box;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px dashed var(--line, #dedede);
  border-radius: 10px;
  background: #fafafa;
  color: #737373;
  text-align: center;
  font-size: 13px;
}

.chart-area small {
  font-size: 11px;
}

.support-list {
  display: grid;
  gap: 17px;
  margin-top: 20px;
}

.support-label {
  display: flex;
  justify-content: space-between;
  margin-bottom: 7px;
  font-size: 12px;
}

.support-track {
  height: 7px;
  border-radius: 20px;
  background: #f0f0f0;
}

.priority-fields {
  display: grid;
  gap: 12px;
  min-width: 0;
  margin: 18px 0 0;
  padding: 0;
  border: 0;
}

.priority-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  font-size: 13px;
}

.priority-row select {
  width: 150px;
  max-width: 60%;
  padding: 9px 10px;
  border: 1px solid var(--line, #e9e9e9);
  border-radius: 8px;
  background: #fafafa;
  color: #626262;
  font: inherit;
  font-size: 12px;
}

.implementation-note {
  margin: 14px 0 0;
  color: #737373;
  font-size: 11px;
}

.page-actions {
  margin-top: 24px;
}

.primary-button {
  display: flex;
  min-height: 44px;
  padding: 10px 20px;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  background: var(--red, #ed003b);
  color: #fff;
  text-align: center;
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
}

.primary-button:hover {
  filter: brightness(0.94);
}

.primary-button:focus-visible,
select:focus-visible {
  outline: 2px solid var(--red, #ed003b);
  outline-offset: 3px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 960px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }
}

/* mobile (maybe take out later if not necessary) */
@media (max-width: 720px) {
  .summary-page {
    padding: 24px 16px 100px;
  }

  .card {
    padding: 20px;
  }
}
</style>