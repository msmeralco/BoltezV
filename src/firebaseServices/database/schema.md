# Firestore Database Schema

## Firestore Database Collections

### `users` Collection: Document Schema

#### Fields:

1. **`displayName`**

    - **Type**: `string`
    - **Description**: The user's display name.

2. **`email`**

    - **Type**: `string`
    - **Description**: The user's email address.

3. **`profileImageUrl`**

    - **Type**: `string`
    - **Description**: The URL of the user's profile image.

4. **`userRole`**

    - **Type**: `string`
    - **Description**: The role of the user. Possible values include `"admin"` and `"regular"`.

5. **`location`**

    - **Type**: `geopoint`
    - **Description**: The user's geographical location, represented as latitude and longitude.

6. **`connections`**

    - **Type**: `map`
    - **Description**: A map of user IDs representing the user's connections. Each key is a `userID` and the value is a `boolean` indicating the connection status.

7. **`pendingRequestsIn`**

    - **Type**: `map`
    - **Description**: A map of incoming connection requests. Each key is a `userID` and the value is a `boolean` indicating the request status.

8. **`pendingRequestsOut`**

    - **Type**: `map`
    - **Description**: A map of outgoing connection requests. Each key is a `userID` and the value is a `boolean` indicating the request status.

9. **`consumptionSummary`**

    - **Type**: `map`
    - **Description**: A map summarizing the user's electricity consumption data. This is primary data used by other summaries and privacy settings. Contains:
        - **`isCalculatedBefore`**: `boolean` — Whether the consumption summary has been calculated before.
        - **`applianceCount`**: `number` — The total number of appliances the user owns.
        - **`topAppliance`**: `string` — Name of the appliance contributing most to consumption.
        - **`estimatedDailyBill`**: `number`
        - **`estimatedWeeklyBill`**: `number`
        - **`estimatedMonthlyBill`**: `number`

10. **`consumptionSharingPrivacy`**

    - **Type**: `string`
    - **Description**: The privacy setting for sharing consumption data. Possible values include `"private"`, `"connectionsOnly"`, and `"public"`.

11. **`actualMonthlyBill`**

    - **Type**: `number`
    - **Description**: The user's actual monthly electricity bill.

12. **`credibilityScore`**

    - **Type**: `number`
    - **Description**: A score representing the user's credibility within the app.

13. **`lastReportTime`**

    - **Type**: `timestamp`
    - **Description**: The timestamp of the user's last report submission.

14. **`inventory`**

    - **Type**: `subcollection`
    - **Description**: The user's inventory of appliances. Each document in this subcollection represents a single appliance (document ID: `applianceId`).

    Appliance document schema (ordered by data dependency):

    1. **`name`**

        - **Type**: `string`
        - **Description**: The name or model of the appliance.

    2. **`type`**

        - **Type**: `string`
        - **Description**: The appliance category (e.g., `"Air Conditioner"`, `"Electric Fan"`, `"Laptop"`, `"Phone"`).

    3. **`wattage`**

        - **Type**: `number`
        - **Description**: The appliance's rated power in watts.

    4. **`hoursPerDay`**

        - **Type**: `number`
        - **Description**: Average hours used per day.

    5. **`daysPerWeek`**

        - **Type**: `number`
        - **Description**: Average days used per week (0–7).

    6. **`specificDaysUsed`**

        - **Type**: `map`
        - **Description**: Flags for usage on specific weekdays. Example: `{ monday: true, tuesday: false, ... }`.

    7. **`weeksPerMonth`**

        - **Type**: `number`
        - **Description**: Average weeks per month the appliance is used.

    8. **`kWhPerDay`**

        - **Type**: `number`
        - **Description**: Energy consumption in kWh/day (can be derived from `wattage` and `hoursPerDay`).

    9. **`dailyCost`**

        - **Type**: `number`
        - **Description**: Cost of running the appliance per day.

    10. **`weeklyCost`**

        - **Type**: `number`
        - **Description**: Cost of running the appliance per week.

    11. **`monthlyCost`**

        - **Type**: `number`
        - **Description**: Cost of running the appliance per month.

    12. **`addedBy`**

        - **Type**: `string`
        - **Description**: Method by which the appliance was added. Possible values: `"ai"`, `"manual"`, `"liveMonitoring"`.

    13. **`imageUrl`**

        - **Type**: `string`
        - **Description**: The image URL (Cloudinary) for the appliance.

### `reports` Collection: Document Schema

#### Fields:

1. **`reporterId`**

    - **Type**: `string`
    - **Description**: UID of the user who submitted the report.

2. **`reporterName`**

    - **Type**: `string`
    - **Description**: Display name of the reporter.

3. **`title`**

    - **Type**: `string`
    - **Description**: Short title for the report.

4. **`description`**

    - **Type**: `string`
    - **Description**: Detailed description of the issue.

5. **`imageURL`**

    - **Type**: `string`
    - **Description**: Image URL (Cloudinary) attached to the report.

6. **`location`**

    - **Type**: `geopoint`
    - **Description**: The location related to the report.

7. **`timeCreated`**

    - **Type**: `timestamp`
    - **Description**: Timestamp when the report was submitted.

8. **`approvalStatus`**

    - **Type**: `string`
    - **Description**: Admin approval status. Values: `"pending"`, `"approved"`, `"rejected"`.

9. **`responseStatus`**

    - **Type**: `string`
    - **Description**: Handling status. Values: `"not started"`,`"in progress"`, `"fixed"`.

### `outages` Collection: Document Schema

#### Fields:

1. **`reporterId`**

    - **Type**: `string`
    - **Description**: UID of the user who submitted the outage report.

2. **`reporterName`**

    - **Type**: `string`
    - **Description**: Display name of the reporter.

3. **`title`**

    - **Type**: `string`
    - **Description**: Short title for the outage.

4. **`description`**

    - **Type**: `string`
    - **Description**: Detailed description of the outage.

5. **`isPlanned`**

    - **Type**: `boolean`
    - **Description**: True if planned, False if unplanned.

6. **`location`**

    - **Type**: `geopoint`
    - **Description**: Primary point location of the outage.

7. **`geopoints`**

    - **Type**: `array[geopoint]`
    - **Description**: Array of geopoints describing the affected polygon/area.

8. **`timeCreated`**

    - **Type**: `timestamp`
    - **Description**: Timestamp when the outage was reported.

9. **`startTime`**

    - **Type**: `timestamp`
    - **Description**: If planned: when the outage will begin.

10. **`endTime`**

    - **Type**: `timestamp`
    - **Description**: If planned: when the outage will end.

11. **`approvalStatus`**

    - **Type**: `string`
    - **Description**: Admin approval status. Values: `"pending"`, `"approved"`, `"rejected"`.

12. **`responseStatus`**

    - **Type**: `string`
    - **Description**: Handling status. Values: `"not started"`,`"in progress"`, `"fixed"`.

### `announcements` Collection: Document Schema

#### Fields:

1.  **`title`**

    - **Type**: `string`
    - **Description**: Title of the announcement.

2.  **`userId`**

    - **Type**: `string`
    - **Description**: UID of the admin user who created the announcement.

3.  **`description`**

    - **Type**: `string`
    - **Description**: Description/body of the announcement.

4.  **`location`**

    - **Type**: `geopoint`
    - **Description**: Primary location for the event.

5.  **`geopoints`**

    - **Type**: `array[geopoint]`
    - **Description**: Array of geopoints used to generate an area polygon for the announcement.

6.  **`startTime`**

    - **Type**: `timestamp`
    - **Description**: Start time of the announced event.

7.  **`endTime`**

    - **Type**: `timestamp`
    - **Description**: End time of the announced event.

8.  **`timeCreated`**

    - **Type**: `timestamp`
    - **Description**: Timestamp when the announcement was uploaded.

9. **`imageUrl`**

    - **Type**: `string`
    - **Description**: Image URL (Cloudinary) attached to the report.

