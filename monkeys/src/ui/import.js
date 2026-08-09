// Sell-Kit import with evidence grading.
// The user decides what's actually cleared (A–D with source) vs uncleared (E–F)

const IFP_EVIDENCE_GRADES = {
  ask: { grade: 'E', reason: 'founder assertion, not sourced' },
  passIf: { grade: 'E', reason: 'success criterion you defined' },
  killIf: { grade: 'E', reason: 'failure criterion you defined' },
  byWhen: { grade: 'E', reason: 'deadline you set' },
  commitmentSignal: { grade: 'E', reason: 'founder assertion' },
  canProve: { grade: 'F', reason: 'model-written, cannot be raised' },
  cannotProve: { grade: 'F', reason: 'model-written, cannot be raised' },
  stopCondition: { grade: 'E', reason: 'founder assertion' },
};

function gradeField(key) {
  return IFP_EVIDENCE_GRADES[key] || { grade: 'E', reason: 'not sourced' };
}

export function renderImportHTML(state) {
  const { pack } = state;
  if (!pack.sellKit || !pack.sellKit.fields) {
    return `<p>No Sell-Kit found. Did you import one in "Set up my ground"?</p>`;
  }

  const { fields } = pack.sellKit;
  const entries = [];

  for (const [key, value] of Object.entries(fields)) {
    if (key === 'importedFrom' || key === 'importedOn' || !value) continue;
    const { grade, reason } = gradeField(key);
    const isClearable = grade === 'E'; // only E (founder assertions) can be promoted by sourcing

    entries.push(`
      <div class="import-field">
        <div class="import-field-label">${escapeHtml(key)}</div>
        <div class="import-field-value">${escapeHtml(value)}</div>
        <div class="import-evidence">
          <span class="grade grade-${grade}">${grade}</span>
          <span class="reason">${escapeHtml(reason)}</span>
        </div>
        ${isClearable ? `
          <div class="import-source">
            <label>If you can source this, paste the link or citation:</label>
            <input type="text"
              class="import-source-input"
              data-key="${escapeHtml(key)}"
              placeholder="https://... or cite the source"
            />
          </div>
        ` : `
          <div class="import-blocked">${grade === 'F'
            ? 'Model-written claims cannot be imported as cleared; source one yourself'
            : 'Not sourced in the kit'
          }</div>
        `}
      </div>
    `);
  }

  return `
    <div class="import-panel">
      <h3>Import Sell-Kit Fields</h3>
      <p>Each field is graded by evidence. Bring sources for grade E (founder assertions) to promote them to Cleared. Grade F (model-written) cannot be imported.</p>
      ${entries.join('')}
      <button class="import-button" data-action="import-kit">Import Checked Fields</button>
    </div>
  `;
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
