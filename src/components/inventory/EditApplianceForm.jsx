import React from "react";

function EditApplianceForm({
  applianceId,
  editFormData,
  handleEditChange,
  handleUpdateAppliance,
  daysOfWeek,
  styles,
  className = "",
}) {
  return (
    <form
      id={`edit-form-${applianceId}`}
      onSubmit={handleUpdateAppliance}
      className={`${styles.addForm} ${className}`}
    >
      <h3 className={styles.span2}>Edit Appliance</h3>

      <div className={styles.formGroup}>
        <label htmlFor={`edit-name-${applianceId}`}>Name:</label>
        <input
          id={`edit-name-${applianceId}`}
          className={styles.formInput}
          type="text"
          name="name"
          value={editFormData.name}
          onChange={handleEditChange}
          required
        />
      </div>

      <div className={styles.formGroup}>
        <label htmlFor={`edit-type-${applianceId}`}>Type:</label>
        <input
          id={`edit-type-${applianceId}`}
          className={styles.formInput}
          type="text"
          name="type"
          value={editFormData.type}
          onChange={handleEditChange}
          required
        />
      </div>

      <div className={styles.formGroup}>
        <label htmlFor={`edit-wattage-${applianceId}`}>Wattage (W):</label>
        <input
          id={`edit-wattage-${applianceId}`}
          className={styles.formInput}
          type="number"
          name="wattage"
          value={editFormData.wattage}
          onChange={handleEditChange}
          required
        />
      </div>

      <div className={styles.formGroup}>
        <label htmlFor={`edit-hours-${applianceId}`}>Hours Per Day:</label>
        <input
          id={`edit-hours-${applianceId}`}
          className={styles.formInput}
          type="number"
          step="0.1"
          name="hoursPerDay"
          value={editFormData.hoursPerDay}
          onChange={handleEditChange}
          required
        />
      </div>

      <div className={styles.formGroup}>
        <label htmlFor={`edit-weeks-${applianceId}`}>Weeks Per Month:</label>
        <input
          id={`edit-weeks-${applianceId}`}
          className={styles.formInput}
          type="number"
          name="weeksPerMonth"
          value={editFormData.weeksPerMonth}
          onChange={handleEditChange}
          required
          min="1"
          max="4"
        />
      </div>

      <fieldset className={styles.span2}>
        <legend>Specific Days Used:</legend>
        <div className={styles.daySelectorCheckboxes}>
          {daysOfWeek.map((day) => (
            <label key={day}>
              <input
                type="checkbox"
                name={day}
                checked={editFormData.specificDaysUsed[day]}
                onChange={handleEditChange}
              />
              {day.charAt(0).toUpperCase() + day.slice(1)}
            </label>
          ))}
        </div>
      </fieldset>
    </form>
  );
}

export default EditApplianceForm;