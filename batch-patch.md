# Task List

## UI/UX Polish
- [ ] **Search Bar**: Make the background transparent to remove the grey-ish tint.
- [ ] **Icons**: Remove the "plus" and "funnel" icons.
- [ ] **Mobile Layout**: Fix top padding to prevent "Quick Actions" from overlapping with the "Rōmy Logo".
- [ ] **Navigation**: Ensure clicking "View Reports" scrolls the page down to the list of prospects.
- [ ] **Cleanup**: Remove the "Save", "Questions" section, & "More Settings" buttons.

## View Details Section Redesign
- [ ] **List Design**: Refactor the prospective donors list (YK the section you see when you click on View Details, that one) to match the layout/design/styling of `@models.dev/` (only the list part of it, nothing else).
- [ ] **List Columns**: Ensure the list displays the same fields found in the CSV export.
- [ ] **Export Button**: Retain the existing green "CSV Export" button.
- [ ] **Top Stats**: Add status cards at the top of the list (How many have proceesed and how many are in total and how many failed) using the "Electricity/Heating/Tax" component style from `@dark-uibank-dashboard-concept/`.

In the main page of the batch processing section:
- [ ] **Report Navigation**: Make the report name clickable to view the report (replacing the "3 dots" menu interaction).
- [ ] **Batch Research**: When a user clicks on the card that says "Batch Research" (the one in the main page of the batch processing section), it should open a simple pop-up with "Drag and drop your prospect list" functionality.

Finally, if you have any thing that you'd like to optimize, make it better - certainly do so! But remember, you need to make this production-ready, non-breaking and do not cause visual, functional or performance bugs. No existing or upcoming feature should be broken, it has to be production-ready. 