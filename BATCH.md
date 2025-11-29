REMEMBER: before proceeding w/ any plans or changes, always analyze and understand the codebase. Do not bring forth any breaking changes. Make sure all changes are production-ready, non-breaking and do not cause visual, functional or performance bugs. No existing or upcoming feature should be broken, it has to be production-ready.

- Instead of having a page /batch, create a clone of the Project View and use that same UI for batch processing. Users can use the upload file button to upload a CSV file or type in names / addresses to be batch proceesed. 
- See how there is a create a project in the sidebar? same thing but for batch uploads
- Users on Growth Plan can upload 10 names / addresses at once (takes away 10 credits away), Users on Pro can upload 50 rows at once and users on scale can upload 100 rows at once.
- I noticed that the RomyScore wasn't being generated, fix that.
- I extracted the CSV file that it gave me and only the names, addresses and net worth were present but everything else, such as City, State, ZIP, RōmyScore, Score Tier, Capacity Rating, Est. Gift Capacity, Recommended Ask, Status were missing. Fix that
- I do like how each report was being a POP-Up but I did see that unlike the normal chat, the report wasn't as extensive - I need it to be similar to how the normal chat's report works / looks like. Also! I didn't notice a sources tab - this is vital, include it. Use the same prompts used by the SYSTEM_PROMPT. The batch-uploads, each report needs to extremely comprehensive and detailed. 
- Use the gemini-chatbot/components/flights/flight-status.tsx, I am not sure how but have it included. Do not by any means tweak the design, have it adapt to the design of the app.

Finally, if you have any thing that you'd like to optimize, make it better - certainly do so! But remember, you need to make this production-ready, non-breaking and do not cause visual, functional or performance bugs. No existing or upcoming feature should be broken, it has to be production-ready. 

If needed search the web, learn more - ONLY IF NEEDED. 

Overall, great design - loved it!