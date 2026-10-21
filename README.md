# 🍽️ Middagsmaskinen

**Live demo:** https://sebtho2104.github.io/Food_planner/

Middagsmaskinen ("the dinner machine") is a small web app that answers the daily question *"what should we have for dinner?"*. You build a library of meals, either your own or ready-made ones from the Find tab. Then you let the app pick something or plan the whole week, choose how many people you're cooking for, and it builds the shopping list, scaling the amounts and adding up ingredients that several meals share.

Built for the vibe coding assignment in DAVE3626 at OsloMet, using generative AI (Claude) to plan, write, test and improve the code.

## Features

- **Meal library:** add meals with how many people they serve, plus ingredients with amounts and units (g, kg, ml, dl, l, pcs, tbsp, tsp, pinch). Edit and delete meals, and search by meal name or ingredient. Click a meal to expand it and see the photo and ingredients.
- **Meal photos:** when you save a meal, the app automatically finds a photo from [TheMealDB](https://www.themealdb.com/). You can cycle through other matches, upload your own photo, or remove it.
- **"Surprise me":** suggests a random meal, skipping meals you've had in the last 3 days. Take it, ask for another, or say no thanks.
- **Week planner:** randomizes dinners for Monday to Sunday without the same meal two days in a row. Reroll single days, and add the whole week to the shopping list.
- **Smart shopping list:** ingredients from several meals are merged. *400 g + 0.8 kg minced beef* becomes *1.2 kg*, *3 dl + 0.5 l milk* becomes *8 dl*, and *banana* + *bananas* becomes *2 × Banana*. Tick items off, add single items yourself, or clear the list.
- **Find meals:** browse and search 13 ready-made meals. Choose the number of people, then save the meal to your library or add it straight to the shopping list.
- **Scaling by number of people:** every meal, suggestion and week plan has a 👥 − / + control. A Taco for 4 with 400 g minced beef becomes 600 g for 6 people. Recipe amounts are rounded sensibly (whole grams, half pieces), and the shopping list rounds pieces up, since you can't buy 2.5 tomatoes.
- **Works on phone and PC**, and everything is saved in the browser.

## How to use

1. Open the [live demo](https://sebtho2104.github.io/Food_planner/), or open `index.html` in a browser.
2. **Find:** save some ready-made meals for the number of people you usually cook for, or press **+ Add meal** in **Meals** to make your own.
3. Press **🎲 Surprise me** for a suggestion, or open a meal, adjust 👥 if needed, and press **🛒 Add to shopping list**.
4. **Week:** press **🎲 Randomize week**, set how many you're cooking for, then add the week to the shopping list.
5. **Shopping:** tick off items while you shop.

## Tech

- Plain **HTML, CSS and JavaScript**, with no frameworks and no build step (`index.html`, `style.css`, `app.js`).
- Data is stored in the browser with **localStorage**, so there is no server, no accounts and no database. Data is per browser and per device.
- Photos come from **TheMealDB's free API**, using its public test key `1`, which is meant for learning projects. No secret API keys are used anywhere.
- Hosted for free on **GitHub Pages**.

## How I used AI

I used **Claude** as my AI coding partner for the whole project:

- **Brainstorming:** I asked for app ideas that fit the assignment, rejected some, and chose the dinner decider.
- **Planning:** the AI suggested a plan with small steps and test cases for each step.
- **Generating code:** I described the features I wanted in plain language (meals with ingredients and units, randomizing a day or a whole week, a shopping list) and the AI wrote the code.
- **Testing:** after each change, the AI ran automated tests of the logic in a simulated browser, and took screenshots at desktop and phone size to check the layout. I tested every version myself in the browser and reported what I wanted changed.
- **Improving:** each round of feedback became a new change and a new commit (see the commit history).

## Development log: testing and improvements

| Round | What I found or wanted | What changed |
|---|---|---|
| 1 | First version | Meal library with units, random pick that skips recent meals, week planner, shopping list that adds amounts together. The AI tested input validation (empty name, amount 0, duplicate meal names) and the unit conversion. |
| 2 | **Bug:** the amount field showed "Amour", because the placeholder text was cut off by the number arrows | Wider field, hid the arrows, shorter placeholder ("Qty"). |
| 3 | Wanted a photo for each meal, and asked about AI image generation | Image generators need a secret API key, which can't be hidden in a public static site, and the assignment says never to publish API keys. Chose **TheMealDB** (real photos, public test key) plus uploading your own photo instead. |
| 4 | The big photos took up too much space | Compact list with small photos. Click to expand and see the details. Added search by name or ingredient. |
| 5 | Wanted to pick several meals for the shopping list, and identical ingredients should merge (1 banana + 1 banana = 2 bananas) | Added a "What to eat?" tab with a list of picked meals, a button on each meal to add it to the shopping list, single items on the shopping list, and smarter merging (ignores capital letters, extra spaces and plural "s"). |
| 6 | The "What to eat?" tab with a dropdown felt confusing in use | **Simplified:** removed the tab and moved picking into the Meals tab (Surprise me, plus a 🛒 button on each meal). |
| 7 | The layout with two big buttons was confusing, and the site could look nicer | Redesign: "What's for dinner?" banner with the randomizer, floating **+ Add meal** button, new fonts, cards and animations. Screenshots at phone size showed cut-off day names, which were fixed with short names ("Mon", "Tue"). |
| 8 | The app is empty for new visitors | 8 starter meals with photos, added once, skipping names you already have. |
| 9 | Publishing | Made the repo public and turned on GitHub Pages. Tested the live site on PC and phone. Found that the URL is case-sensitive (`Food_planner`). |
| 10 | I wanted the meal list to start empty, with a place to *find* ready-made meals, and to choose how many people a meal is for, with amounts scaling automatically | Removed the automatic starter meals (and cleaned them out of browsers that already had them). Added a **Find** tab with 13 recipes. Added **Serves X people** to every meal, plus a 👥 − / + control on meals, suggestions and the week plan that scales all amounts. Testing showed the shopping list asking for things like "2.5 × Tomatoes", so pieces are now rounded up on the shopping list and amounts are rounded sensibly in recipes. |

## Limitations

- Data is saved per browser, so meals added on the phone don't show up on the PC. Syncing would need a server and accounts.
- Ingredient merging only understands English plurals, and can't merge different kinds of units (400 g and 2 pcs of the same thing).
- Automatic photos only work for dishes TheMealDB knows. Other meals get a 🍽️ placeholder or your own photo.
