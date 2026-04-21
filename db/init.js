const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'flanigans.db');

let db;

function getDB() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDB() {
  const database = getDB();

  database.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL DEFAULT 'Main',
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      ingredients TEXT DEFAULT '',
      recipe TEXT DEFAULT '',
      price TEXT DEFAULT '',
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS faqs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT DEFAULT '',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user','assistant')),
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at);
  `);

  // Seed admin user
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'flanigans2024';
  const existingAdmin = database.prepare('SELECT id FROM admin_users WHERE username = ?').get(adminUsername);
  if (!existingAdmin) {
    const hash = bcrypt.hashSync(adminPassword, 10);
    database.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run(adminUsername, hash);
    console.log(`Admin user created: ${adminUsername}`);
  }

  // Seed default settings
  const defaults = [
    ['restaurant_name', "Flanigan's Seafood Bar and Grill"],
    ['tagline', 'Laid Back Family-Run Restaurants in South Florida'],
    ['founded', '1959'],
    ['address', 'Multiple locations across South Florida — visit flanigans.net for the nearest one!'],
    ['phone', 'Check flanigans.net for your nearest location phone number'],
    ['hours', 'Open daily — hours vary by location. Visit flanigans.net for details.'],
    ['website', 'https://www.flanigans.net'],
    ['bot_greeting', "Hey there, welcome to Flanigan's! South Florida's favorite neighborhood hangout since 1959. Whether you're craving wings, a burger, or just wanna know what's good — I'm here to help! What can I do for ya?"],
    ['bot_personality', "Friendly and laid-back, like a warm South Florida bartender who's worked at Flanigan's for years. Casual, enthusiastic about the food, and proud of the big portions and great value. Occasionally use 'ya' instead of 'you'. Reference South Florida culture, the beach, and local pride when it fits naturally. Always make guests feel like family."],
    ['custom_instructions', ''],
  ];

  const upsert = database.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [key, value] of defaults) {
    upsert.run(key, value);
  }

  // Seed menu items
  const menuCount = database.prepare('SELECT COUNT(*) as count FROM menu_items').get();
  if (menuCount.count === 0) {
    const insertItem = database.prepare(
      'INSERT INTO menu_items (category, name, description, ingredients, recipe, price) VALUES (?, ?, ?, ?, ?, ?)'
    );

    const items = [
      [
        'Burgers & Sandwiches',
        'Classic Cheeseburger',
        'A juicy 80/20 ground beef patty topped with melted cheddar or American cheese, crisp lettuce, fresh tomato, and onion on a lightly toasted bun. Classic and satisfying.',
        'Ground beef (80/20), salt & pepper, burger buns, cheese slices (cheddar or American), lettuce, tomato, onion, pickles (optional), ketchup & mustard',
        'Season beef with salt and pepper, form into patties. Grill or pan-cook ~3–4 minutes per side. Add cheese in the last minute to melt. Toast buns lightly. Assemble with toppings and sauces.',
        '',
      ],
      [
        'Appetizers',
        'Buffalo Wings',
        'Crispy chicken wings tossed in a rich butter and hot sauce blend — the perfect balance of heat and flavor. Served with your choice of ranch or blue cheese dressing.',
        'Chicken wings, salt & pepper, oil (for frying or baking), butter, hot sauce',
        'Season wings with salt and pepper. Fry at 375°F for ~10–12 minutes OR bake at 400°F for ~40–45 minutes. Melt butter and mix with hot sauce. Toss cooked wings in the sauce. Serve with ranch or blue cheese.',
        '',
      ],
      [
        'Appetizers',
        'Chicken Quesadilla',
        'Grilled flour tortilla filled with seasoned chicken, gooey melted cheese, and sautéed bell peppers and onions. Served with salsa and sour cream.',
        'Flour tortillas, cooked chicken (shredded or diced), shredded cheese (cheddar or Mexican blend), bell peppers & onions, oil or butter',
        'Cook peppers and onions until soft. Add chicken and warm through. Place mixture and cheese on one half of a tortilla. Fold and cook in a pan until golden and cheese melts. Slice and serve with salsa or sour cream.',
        '',
      ],
      [
        'Sides',
        'Loaded Fries',
        'Golden crispy fries piled high with cheese sauce, crispy bacon bits, fresh green onions, and cool sour cream. A crowd favorite!',
        'Frozen or fresh fries, cheese sauce or shredded cheese, cooked bacon bits, green onions, sour cream',
        'Cook fries until crispy. Top with cheese and melt in oven or under broiler. Add bacon, green onions, and sour cream. Serve immediately.',
        '',
      ],
      [
        'Burgers & Sandwiches',
        'Grilled Chicken Sandwich',
        'A perfectly seasoned grilled chicken breast on a toasted bun with crisp lettuce, fresh tomato, and your choice of sauce. Light, fresh, and delicious.',
        'Chicken breast, salt, pepper, garlic powder, burger buns, lettuce, tomato, mayo or sauce of choice',
        'Season chicken with salt, pepper, and garlic powder. Grill or pan-cook ~5–6 minutes per side until fully cooked. Toast buns lightly. Assemble with toppings and sauce.',
        '',
      ],
      [
        'Entrees',
        'BBQ Baby Back Ribs (Sports Grill Style)',
        'A full rack of tender baby back pork ribs coated in a smoky dry rub, slow-cooked to fall-off-the-bone perfection, and finished with a honey-butter BBQ glaze. No sesame.',
        'Ribs: 1 rack baby back pork ribs. Dry Rub: 2 tbsp brown sugar, 1 tbsp paprika, 1 tsp salt, 1 tsp black pepper, 1 tsp garlic powder, 1 tsp onion powder, 1/2 tsp chili powder. BBQ Sauce: 1 cup BBQ sauce, 1 tbsp honey, 1 tbsp butter. Contains no sesame.',
        'Mix dry rub ingredients and coat ribs thoroughly. Wrap in foil and bake at 275°F for 2.5–3 hours until tender. Melt butter with honey and stir into BBQ sauce. Unwrap ribs, brush with sauce, and broil or grill 3–5 minutes to caramelize. Serve with extra sauce on the side.',
        '',
      ],
    ];

    for (const item of items) {
      insertItem.run(...item);
    }
  }

  // Seed FAQs
  const faqCount = database.prepare('SELECT COUNT(*) as count FROM faqs').get();
  if (faqCount.count === 0) {
    const insertFAQ = database.prepare('INSERT INTO faqs (question, answer) VALUES (?, ?)');
    const faqs = [
      [
        "What kind of food does Flanigan's serve?",
        "Flanigan's is your classic South Florida neighborhood spot! We're famous for our seafood, baby back ribs, burgers, wings, and a whole lot more. There's truly something for everyone on our menu — big portions, great flavors, and that laid-back Flanigan's vibe.",
      ],
      [
        "How many Flanigan's locations are there?",
        "We've got 20+ locations all across South Florida — from Miami to Fort Lauderdale and beyond! Head over to flanigans.net to find your nearest spot.",
      ],
      [
        "When was Flanigan's founded?",
        "Flanigan's has been a beloved South Florida institution since 1959! That's over 65 years of serving up good food, good drinks, and good times. We're a family-run operation and proud of every year.",
      ],
      [
        "Does Flanigan's take reservations?",
        "Flanigan's is a come-as-you-are kind of place — casual and welcoming! We typically operate on a first-come, first-served basis. For large groups, we recommend calling your nearest location ahead of time.",
      ],
      [
        "What are your hours?",
        "Hours vary by location, so your best bet is to check flanigans.net or give your local Flanigan's a call. We're open daily — come on in!",
      ],
      [
        "Is Flanigan's good for families?",
        "Absolutely! Flanigan's is all about family. We love having everyone — kids, parents, grandparents, the whole crew. It's a warm, casual environment where everyone feels right at home.",
      ],
      [
        "What is Flanigan's known for?",
        "Besides the amazing food? The atmosphere! We're kitschy, nautical, full of character — fishing nets, vintage photos, sports memorabilia, and those iconic green lights. It's a one-of-a-kind South Florida experience. Oh, and the portions — they're ginormous!",
      ],
      [
        "Do you have vegetarian or dietary options?",
        "We have options that can work for various dietary needs! Our menu has salads, sides, and we're happy to accommodate when possible. Ask your server for the best options for you.",
      ],
      [
        "What deals or specials does Flanigan's have?",
        "Flanigan's has tons of great deals! Here's a full rundown:\n\n🍔 $6.99 Lunch Specials — Mon–Fri, 11AM–4PM. Includes a beverage. Choose from a 10oz burger, wings, soup & salad, or chicken sandwich.\n\n🍺 Free Appetizer with Pitcher — Every night 10PM–12AM. Get free curly fries, tumbleweed onions, or chicken wings with any pitcher purchase (beer, iced tea, lemonade, or soda).\n\n🍖 Joe's Meal Deals — Sun–Thu, open to close. Includes your meal + Caesar salad + garlic rolls + free drink. Prices range from $17.99–$26.99 (wings, ribs, or steak).\n\n🍻 Happy Hour — Daily 9PM to close AND Mon–Fri 4PM–7PM. 50% off all beer, wine, and liquor.\n\n🧀 Monday Pitcher Special — Free loaded nachos with any pitcher purchase.\n\n🍗 Wing It Wednesday — Free wings with any pitcher purchase.\n\n♻️ Return Your Cup — Bring back your Flanigan's green cup for $1 off your drink.\n\n📱 Lunch Club App — Download the app and earn a free 11th lunch after 10 punches.\n\nAsk me about any of these for more details!",
      ],
      [
        "What is Happy Hour at Flanigan's?",
        "Happy Hour at Flanigan's runs twice daily: Mon–Fri from 4PM–7PM, and every night from 9PM to close. During Happy Hour you get 50% off all beer, wine, and liquor. It's one of the best deals in South Florida!",
      ],
      [
        "Does Flanigan's have lunch specials?",
        "Yes! Flanigan's $6.99 Lunch Specials run Monday through Friday from 11AM–4PM and include a beverage. You can choose from a 10oz burger, wings, soup & salad, or a chicken sandwich. Great value for a full meal!",
      ],
      [
        "What is Joe's Meal Deal?",
        "Joe's Meal Deal is available Sunday through Thursday, open to close. Each deal includes your entrée, a Caesar salad, garlic rolls, and a free drink. Options and prices: Wings ($17.99), Ribs ($24.99), and Steak ($26.99). It's one of the best value dinners on the menu!",
      ],
      [
        "Does Flanigan's have free appetizers or free wings?",
        "Yes! Two ways to score free food:\n\n• Every night from 10PM–12AM, get a free appetizer (curly fries, tumbleweed onions, or chicken wings) with any pitcher purchase of beer, iced tea, lemonade, or soda.\n• Every Wednesday (Wing It Wednesday), get free wings with any pitcher purchase.",
      ],
      [
        "What is Wing It Wednesday at Flanigan's?",
        "Every Wednesday at Flanigan's is Wing It Wednesday — buy any pitcher and get free wings on us! It's a great mid-week excuse to come hang out.",
      ],
      [
        "What is the Monday Pitcher Special?",
        "Every Monday, buy any pitcher and get free loaded nachos on the house. It's the perfect way to start the week at Flanigan's!",
      ],
      [
        "Can I get a discount for bringing back my Flanigan's cup?",
        "Absolutely! If you bring back your Flanigan's green cup, you get $1 off your drink. Every time. It's our way of saying thanks for being a regular!",
      ],
      [
        "Does Flanigan's have a loyalty app or punch card?",
        "Yes! Download the Flanigan's Lunch Club app and earn a punch for every lunch visit. After 10 lunches, your 11th lunch is free. It's a great deal if you're a regular lunch customer.",
      ],

    for (const [q, a] of faqs) {
      insertFAQ.run(q, a);
    }
  }

  console.log("✅ Flanigan's database ready");
  return database;
}

module.exports = { getDB, initDB };
