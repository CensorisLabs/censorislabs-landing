// AbsoluteCal built-in food + exercise database.
// Food values are per 100 g: [kcal, protein, carbs, fat, fiber, sugar, sodium mg].
// serv: common servings as [label, grams].

const F = (name, cat, kcal, p, c, f, fi = 0, su = 0, na = 0, serv = [], kw = '') =>
  ({ name, cat, kcal, p, c, f, fi, su, na, serv, kw })

export const FOOD_CATEGORIES = ['Grains & Breads', 'Dals & Legumes', 'Dairy & Eggs', 'Meat & Fish', 'Vegetables', 'Fruits', 'Nuts & Seeds', 'Snacks & Fast Food', 'Sweets & Desserts', 'Drinks', 'Oils & Condiments']

export const FOODS = [
  // Grains & Breads
  F('White rice, cooked', 'Grains & Breads', 130, 2.7, 28, 0.3, 0.4, 0.1, 1, [['1 cup', 158]], 'chawal bhaat'),
  F('Brown rice, cooked', 'Grains & Breads', 112, 2.6, 24, 0.9, 1.8, 0.4, 5, [['1 cup', 195]]),
  F('Basmati rice, cooked', 'Grains & Breads', 121, 3.5, 25, 0.4, 0.6, 0.1, 2, [['1 cup', 160]]),
  F('Roti / chapati', 'Grains & Breads', 297, 8.7, 55, 5.4, 7.8, 2.4, 340, [['1 roti', 40]], 'fulka'),
  F('Naan', 'Grains & Breads', 310, 9, 55, 5.1, 2.2, 3.1, 418, [['1 naan', 90]]),
  F('Paratha, plain', 'Grains & Breads', 320, 6.4, 45, 13, 6.1, 1.6, 360, [['1 paratha', 80]]),
  F('Whole wheat bread', 'Grains & Breads', 247, 13, 41, 3.4, 7, 6, 400, [['1 slice', 32]]),
  F('White bread', 'Grains & Breads', 265, 9, 49, 3.2, 2.7, 5, 491, [['1 slice', 30]]),
  F('Oats, dry', 'Grains & Breads', 389, 17, 66, 7, 10.6, 1, 2, [['1/2 cup', 40]], 'oatmeal'),
  F('Poha, cooked', 'Grains & Breads', 130, 2.6, 24, 3, 1.2, 1, 250, [['1 plate', 150]], 'flattened rice'),
  F('Upma', 'Grains & Breads', 155, 4, 24, 5.5, 1.8, 1.2, 300, [['1 cup', 170]]),
  F('Idli', 'Grains & Breads', 146, 4.4, 30, 0.6, 1.5, 0.5, 290, [['1 idli', 50]]),
  F('Dosa, plain', 'Grains & Breads', 168, 4.1, 29, 3.7, 1.1, 0.4, 250, [['1 dosa', 100]]),
  F('Masala dosa', 'Grains & Breads', 190, 4.6, 30, 6, 2, 1.5, 380, [['1 dosa', 220]]),
  F('Quinoa, cooked', 'Grains & Breads', 120, 4.4, 21, 1.9, 2.8, 0.9, 7, [['1 cup', 185]]),
  F('Cornflakes', 'Grains & Breads', 357, 7.5, 84, 0.4, 3, 8, 950, [['1 bowl', 30]]),
  F('Muesli', 'Grains & Breads', 363, 9.7, 66, 5.9, 8, 19, 120, [['1 bowl', 45]]),
  F('Pasta, cooked', 'Grains & Breads', 158, 5.8, 31, 0.9, 1.8, 0.6, 1, [['1 cup', 140]], 'spaghetti macaroni'),
  F('Instant noodles, cooked', 'Grains & Breads', 138, 3.2, 19, 5.8, 1, 0.8, 480, [['1 pack', 70]], 'maggi ramen'),
  F('Khichdi', 'Grains & Breads', 118, 4.3, 20, 2.4, 1.8, 0.6, 260, [['1 cup', 200]]),
  F('Chicken biryani', 'Grains & Breads', 165, 8.5, 20, 5.6, 0.8, 1, 320, [['1 plate', 300]]),
  F('Veg biryani', 'Grains & Breads', 150, 3.8, 24, 4.6, 1.5, 1.5, 300, [['1 plate', 300]]),
  F('Ragi porridge', 'Grains & Breads', 92, 2.6, 17, 1.1, 3.1, 0.5, 8, [['1 cup', 200]], 'millet'),
  F('Semolina (rava/sooji), dry', 'Grains & Breads', 360, 12.7, 73, 1.1, 3.9, 0.7, 1),

  // Dals & Legumes
  F('Moong dal, cooked', 'Dals & Legumes', 105, 7, 18, 0.8, 4.5, 1.2, 240, [['1 katori', 150]]),
  F('Toor dal, cooked', 'Dals & Legumes', 110, 7.2, 18, 1.2, 4.1, 1, 250, [['1 katori', 150]], 'arhar'),
  F('Masoor dal, cooked', 'Dals & Legumes', 116, 9, 20, 0.4, 7.9, 1.8, 240, [['1 katori', 150]]),
  F('Chana dal, cooked', 'Dals & Legumes', 164, 8.9, 27, 2.6, 7.6, 1.5, 250, [['1 katori', 150]]),
  F('Rajma, cooked curry', 'Dals & Legumes', 112, 7.5, 17, 1.4, 6.4, 1, 290, [['1 katori', 150]], 'kidney beans'),
  F('Chole / chickpea curry', 'Dals & Legumes', 138, 7.4, 19, 4.2, 6.8, 2, 320, [['1 katori', 150]], 'chana masala'),
  F('Black chana, boiled', 'Dals & Legumes', 164, 8.9, 27, 2.6, 7.6, 1.2, 12, [['1 cup', 164]]),
  F('Sprouted moong', 'Dals & Legumes', 30, 3, 6, 0.2, 1.8, 1, 6, [['1 cup', 100]]),
  F('Soybeans, cooked', 'Dals & Legumes', 173, 16.6, 9.9, 9, 6, 3, 1, [['1 cup', 172]]),
  F('Urad dal, cooked', 'Dals & Legumes', 116, 8.5, 19, 0.7, 5.6, 0.8, 240),
  F('Besan (gram flour)', 'Dals & Legumes', 387, 22, 58, 6.7, 10.8, 5.8, 64),
  F('Hummus', 'Dals & Legumes', 166, 7.9, 14, 9.6, 6, 0.3, 379, [['2 tbsp', 30]]),
  F('Sambar', 'Dals & Legumes', 65, 3.1, 9, 2.2, 2.4, 2.4, 380, [['1 katori', 150]]),
  F('Dal makhani', 'Dals & Legumes', 122, 5.2, 11, 6.3, 3.4, 1.2, 340, [['1 katori', 150]]),
  F('Dal fry / tadka', 'Dals & Legumes', 108, 6, 15, 3.2, 4, 1, 280, [['1 katori', 150]]),

  // Dairy & Eggs
  F('Milk, whole', 'Dairy & Eggs', 61, 3.2, 4.8, 3.3, 0, 4.8, 43, [['1 glass', 250]]),
  F('Milk, skim', 'Dairy & Eggs', 34, 3.4, 5, 0.1, 0, 5, 42, [['1 glass', 250]], 'toned low fat'),
  F('Curd / yogurt, plain', 'Dairy & Eggs', 61, 3.5, 4.7, 3.3, 0, 4.7, 46, [['1 katori', 150]], 'dahi'),
  F('Greek yogurt, plain', 'Dairy & Eggs', 97, 9, 3.9, 5, 0, 3.6, 35, [['1 cup', 170]]),
  F('Paneer', 'Dairy & Eggs', 265, 18.3, 3.6, 20.8, 0, 0.5, 19, [['50 g', 50]], 'cottage cheese'),
  F('Cheddar cheese', 'Dairy & Eggs', 402, 25, 1.3, 33, 0, 0.5, 621, [['1 slice', 28]]),
  F('Butter', 'Dairy & Eggs', 717, 0.9, 0.1, 81, 0, 0.1, 643, [['1 tsp', 5]]),
  F('Ghee', 'Dairy & Eggs', 900, 0, 0, 100, 0, 0, 0, [['1 tsp', 5]]),
  F('Cream, fresh', 'Dairy & Eggs', 340, 2.1, 2.9, 36, 0, 2.9, 36, [['1 tbsp', 15]], 'malai'),
  F('Buttermilk (chaas)', 'Dairy & Eggs', 30, 2.4, 3.6, 0.9, 0, 3.6, 105, [['1 glass', 250]]),
  F('Sweet lassi', 'Dairy & Eggs', 82, 2.8, 12, 2.4, 0, 11, 60, [['1 glass', 250]]),
  F('Egg, boiled', 'Dairy & Eggs', 155, 13, 1.1, 11, 0, 1.1, 124, [['1 egg', 50]]),
  F('Egg white', 'Dairy & Eggs', 52, 11, 0.7, 0.2, 0, 0.7, 166, [['1 white', 33]]),
  F('Omelette (2 eggs + oil)', 'Dairy & Eggs', 196, 13, 1.6, 15, 0, 1, 300, [['1 omelette', 120]]),
  F('Egg bhurji', 'Dairy & Eggs', 180, 12, 3, 13, 0.4, 1.5, 320, [['1 serving', 130]], 'scrambled anda'),

  // Meat & Fish
  F('Chicken breast, cooked', 'Meat & Fish', 165, 31, 0, 3.6, 0, 0, 74, [['1 breast', 120]]),
  F('Chicken curry', 'Meat & Fish', 148, 14, 4, 8.5, 0.8, 1.5, 380, [['1 katori', 180]]),
  F('Chicken thigh, roasted', 'Meat & Fish', 209, 26, 0, 10.9, 0, 0, 88, [['1 thigh', 100]]),
  F('Tandoori chicken', 'Meat & Fish', 170, 27, 2, 5.5, 0.3, 1, 420, [['1 piece', 120]]),
  F('Mutton curry', 'Meat & Fish', 190, 16, 3.5, 12, 0.6, 1, 400, [['1 katori', 180]], 'lamb goat'),
  F('Fish, rohu, cooked', 'Meat & Fish', 97, 16.6, 0, 3.2, 0, 0, 60, [['1 piece', 100]]),
  F('Fish curry', 'Meat & Fish', 120, 13, 3, 6, 0.6, 1.5, 350, [['1 katori', 180]]),
  F('Salmon, cooked', 'Meat & Fish', 208, 20, 0, 13, 0, 0, 59, [['1 fillet', 120]]),
  F('Tuna, canned in water', 'Meat & Fish', 116, 26, 0, 1, 0, 0, 320, [['1 can', 142]]),
  F('Prawns, cooked', 'Meat & Fish', 99, 24, 0.2, 0.3, 0, 0, 111, [['100 g', 100]], 'shrimp'),
  F('Keema (minced chicken)', 'Meat & Fish', 172, 20, 2.5, 8.5, 0.4, 1, 360, [['1 katori', 150]]),

  // Vegetables
  F('Potato, boiled', 'Vegetables', 87, 1.9, 20, 0.1, 1.8, 0.9, 5, [['1 medium', 150]], 'aloo'),
  F('Potato, fried (bhujia)', 'Vegetables', 210, 2.8, 25, 11, 2.2, 0.6, 290),
  F('Tomato', 'Vegetables', 18, 0.9, 3.9, 0.2, 1.2, 2.6, 5, [['1 medium', 120]]),
  F('Onion', 'Vegetables', 40, 1.1, 9.3, 0.1, 1.7, 4.2, 4, [['1 medium', 110]]),
  F('Spinach, cooked (palak)', 'Vegetables', 23, 3, 3.8, 0.3, 2.4, 0.4, 80, [['1 katori', 150]]),
  F('Cauliflower (gobi), cooked', 'Vegetables', 25, 1.9, 5, 0.3, 2, 1.9, 30),
  F('Cabbage, cooked', 'Vegetables', 25, 1.3, 5.5, 0.1, 2.2, 2.8, 18),
  F('Carrot', 'Vegetables', 41, 0.9, 9.6, 0.2, 2.8, 4.7, 69, [['1 medium', 61]]),
  F('Green peas, cooked', 'Vegetables', 84, 5.4, 15, 0.4, 5.7, 5.7, 70, [['1 katori', 160]], 'matar'),
  F('French beans, cooked', 'Vegetables', 35, 1.9, 8, 0.3, 3.2, 1.6, 6),
  F('Brinjal / eggplant, cooked', 'Vegetables', 35, 0.8, 8.7, 0.2, 2.5, 3.2, 2, [], 'baingan'),
  F('Okra (bhindi), cooked', 'Vegetables', 33, 2, 7, 0.2, 3.2, 1.5, 8),
  F('Capsicum / bell pepper', 'Vegetables', 26, 1, 4.6, 0.3, 1.7, 2.4, 2, [['1 medium', 120]]),
  F('Cucumber', 'Vegetables', 15, 0.7, 3.6, 0.1, 0.5, 1.7, 2, [['1 medium', 200]], 'kheera'),
  F('Broccoli, cooked', 'Vegetables', 35, 2.4, 7, 0.4, 3.3, 1.4, 41),
  F('Mushroom, cooked', 'Vegetables', 28, 2.2, 5.3, 0.5, 2.2, 2, 4),
  F('Mixed veg sabzi', 'Vegetables', 68, 2, 9, 3, 2.8, 2.5, 280, [['1 katori', 150]]),
  F('Aloo gobi', 'Vegetables', 95, 2.4, 13, 4.2, 2.6, 1.8, 300, [['1 katori', 150]]),
  F('Palak paneer', 'Vegetables', 128, 8.5, 5.5, 8.2, 2, 1.2, 330, [['1 katori', 150]]),
  F('Bhindi masala', 'Vegetables', 85, 2.4, 8.5, 5, 3, 1.8, 290, [['1 katori', 150]]),
  F('Bitter gourd (karela), cooked', 'Vegetables', 24, 1.5, 4.7, 0.2, 2.6, 1.9, 6),
  F('Pumpkin, cooked', 'Vegetables', 26, 1, 6.5, 0.1, 1.1, 1.4, 2, [], 'kaddu'),
  F('Beetroot', 'Vegetables', 43, 1.6, 9.6, 0.2, 2.8, 6.8, 78, [['1 medium', 82]]),
  F('Corn, boiled', 'Vegetables', 96, 3.4, 21, 1.5, 2.4, 4.5, 15, [['1 cob', 90]], 'sweet corn bhutta'),
  F('Lettuce', 'Vegetables', 15, 1.4, 2.9, 0.2, 1.3, 0.8, 28),
  F('Radish (mooli)', 'Vegetables', 16, 0.7, 3.4, 0.1, 1.6, 1.9, 39),

  // Fruits
  F('Banana', 'Fruits', 89, 1.1, 23, 0.3, 2.6, 12, 1, [['1 medium', 118]]),
  F('Apple', 'Fruits', 52, 0.3, 14, 0.2, 2.4, 10, 1, [['1 medium', 182]]),
  F('Mango', 'Fruits', 60, 0.8, 15, 0.4, 1.6, 14, 1, [['1 medium', 200]], 'aam'),
  F('Orange', 'Fruits', 47, 0.9, 12, 0.1, 2.4, 9, 0, [['1 medium', 131]], 'santra'),
  F('Papaya', 'Fruits', 43, 0.5, 11, 0.3, 1.7, 7.8, 8, [['1 cup', 140]]),
  F('Grapes', 'Fruits', 69, 0.7, 18, 0.2, 0.9, 16, 2, [['1 cup', 151]], 'angoor'),
  F('Guava', 'Fruits', 68, 2.6, 14, 1, 5.4, 9, 2, [['1 medium', 100]], 'amrood'),
  F('Pomegranate', 'Fruits', 83, 1.7, 19, 1.2, 4, 14, 3, [['1 medium', 150]], 'anar'),
  F('Watermelon', 'Fruits', 30, 0.6, 7.6, 0.2, 0.4, 6.2, 1, [['1 cup', 152]]),
  F('Pineapple', 'Fruits', 50, 0.5, 13, 0.1, 1.4, 10, 1, [['1 cup', 165]]),
  F('Kiwi', 'Fruits', 61, 1.1, 15, 0.5, 3, 9, 3, [['1 fruit', 69]]),
  F('Strawberries', 'Fruits', 32, 0.7, 7.7, 0.3, 2, 4.9, 1, [['1 cup', 150]]),
  F('Chikoo / sapota', 'Fruits', 83, 0.4, 20, 1.1, 5.3, 12, 12, [['1 fruit', 80]]),
  F('Coconut, fresh', 'Fruits', 354, 3.3, 15, 33, 9, 6, 20, [['1/4 cup', 40]], 'nariyal'),
  F('Dates', 'Fruits', 282, 2.5, 75, 0.4, 8, 63, 2, [['3 dates', 24]], 'khajoor'),
  F('Raisins', 'Fruits', 299, 3.1, 79, 0.5, 3.7, 59, 11, [['2 tbsp', 28]], 'kishmish'),

  // Nuts & Seeds
  F('Almonds', 'Nuts & Seeds', 579, 21, 22, 50, 12.5, 4.4, 1, [['10 nuts', 12]], 'badam'),
  F('Cashews', 'Nuts & Seeds', 553, 18, 30, 44, 3.3, 5.9, 12, [['10 nuts', 15]], 'kaju'),
  F('Walnuts', 'Nuts & Seeds', 654, 15, 14, 65, 6.7, 2.6, 2, [['7 halves', 14]], 'akhrot'),
  F('Peanuts, roasted', 'Nuts & Seeds', 567, 26, 16, 49, 8.5, 4, 6, [['small handful', 30]]),
  F('Peanut butter', 'Nuts & Seeds', 588, 25, 20, 50, 6, 9, 459, [['1 tbsp', 16]]),
  F('Chia seeds', 'Nuts & Seeds', 486, 17, 42, 31, 34, 0, 16, [['1 tbsp', 12]]),
  F('Flax seeds', 'Nuts & Seeds', 534, 18, 29, 42, 27, 1.6, 30, [['1 tbsp', 10]], 'alsi'),
  F('Pumpkin seeds', 'Nuts & Seeds', 559, 30, 11, 49, 6, 1.4, 7, [['1 tbsp', 10]]),
  F('Trail mix', 'Nuts & Seeds', 462, 14, 45, 29, 5, 29, 90, [['small handful', 30]]),

  // Snacks & Fast Food
  F('Samosa', 'Snacks & Fast Food', 262, 4.5, 29, 14, 2.2, 1, 420, [['1 piece', 100]]),
  F('Pakora (mixed)', 'Snacks & Fast Food', 240, 6, 20, 15, 2.5, 1.5, 380, [['4 pieces', 80]], 'bhajiya'),
  F('Vada pav', 'Snacks & Fast Food', 290, 6.5, 40, 11, 3, 2, 520, [['1 piece', 145]]),
  F('Pav bhaji', 'Snacks & Fast Food', 175, 4.2, 22, 8, 3.2, 4, 480, [['1 plate', 250]]),
  F('Chole bhature', 'Snacks & Fast Food', 280, 8, 38, 11, 5, 2.5, 550, [['1 plate', 350]]),
  F('Veg momos, steamed', 'Snacks & Fast Food', 160, 5, 28, 3, 1.8, 1.5, 400, [['1 piece', 35]]),
  F('Spring roll, veg', 'Snacks & Fast Food', 200, 4, 24, 9.5, 1.8, 1.8, 420, [['1 piece', 60]]),
  F('Veg burger', 'Snacks & Fast Food', 240, 7, 32, 9, 2.5, 3.5, 520, [['1 burger', 180]]),
  F('Pizza, veg, 1 slice', 'Snacks & Fast Food', 266, 11, 33, 10, 2.3, 3.6, 598, [['1 slice', 107]]),
  F('French fries', 'Snacks & Fast Food', 312, 3.4, 41, 15, 3.8, 0.6, 210, [['medium', 117]]),
  F('Veg sandwich', 'Snacks & Fast Food', 190, 6, 28, 6, 3, 3, 430, [['1 sandwich', 150]]),
  F('Potato chips', 'Snacks & Fast Food', 536, 7, 53, 35, 4.4, 0.6, 525, [['small pack', 30]]),
  F('Milk chocolate', 'Snacks & Fast Food', 535, 7.6, 59, 30, 3.4, 52, 79, [['4 squares', 25]]),
  F('Dark chocolate (70%)', 'Snacks & Fast Food', 598, 7.8, 46, 43, 11, 24, 20, [['4 squares', 25]]),
  F('Digestive biscuits', 'Snacks & Fast Food', 471, 6.9, 62, 21, 3.5, 16, 480, [['2 biscuits', 30]]),
  F('Glucose biscuits', 'Snacks & Fast Food', 440, 7, 72, 14, 1.5, 22, 350, [['4 biscuits', 28]], 'parle-g'),
  F('Namkeen mixture', 'Snacks & Fast Food', 520, 12, 42, 34, 5, 2, 780, [['small bowl', 30]]),
  F('Popcorn, air-popped', 'Snacks & Fast Food', 387, 13, 78, 4.5, 15, 1.2, 4, [['3 cups', 24]]),
  F('Dhokla', 'Snacks & Fast Food', 152, 6.5, 22, 4.5, 1.8, 3, 430, [['2 pieces', 80]]),
  F('Thepla', 'Snacks & Fast Food', 230, 6, 30, 9.5, 4, 1.5, 400, [['1 thepla', 50]]),
  F('Banana chips', 'Snacks & Fast Food', 519, 2.3, 58, 34, 7.7, 35, 6, [['small bowl', 30]]),
  F('Protein bar', 'Snacks & Fast Food', 350, 30, 38, 9, 8, 12, 250, [['1 bar', 60]]),
  F('Medu vada', 'Snacks & Fast Food', 290, 8, 25, 17, 3, 0.8, 410, [['1 piece', 60]]),
  F('Aloo tikki', 'Snacks & Fast Food', 195, 3.5, 24, 9.5, 2.4, 1.2, 320, [['1 piece', 80]]),

  // Sweets & Desserts
  F('Gulab jamun', 'Sweets & Desserts', 300, 4.5, 45, 12, 0.4, 38, 130, [['1 piece', 50]]),
  F('Rasgulla', 'Sweets & Desserts', 186, 4, 38, 2.5, 0, 34, 60, [['1 piece', 50]]),
  F('Jalebi', 'Sweets & Desserts', 380, 3.5, 68, 14, 0.5, 45, 120, [['4 pieces', 80]]),
  F('Besan laddu', 'Sweets & Desserts', 430, 8, 50, 22, 3, 32, 80, [['1 laddu', 45]]),
  F('Coconut barfi', 'Sweets & Desserts', 420, 4, 52, 22, 3.5, 40, 60, [['1 piece', 40]]),
  F('Sooji halwa', 'Sweets & Desserts', 285, 4.5, 42, 11, 1.2, 28, 90, [['1 katori', 120]]),
  F('Kheer', 'Sweets & Desserts', 140, 4, 20, 4.8, 0.2, 17, 70, [['1 katori', 150]]),
  F('Ice cream, vanilla', 'Sweets & Desserts', 207, 3.5, 24, 11, 0.7, 21, 80, [['1 scoop', 66]]),
  F('Chocolate cake', 'Sweets & Desserts', 371, 5.3, 53, 16, 2.2, 38, 340, [['1 slice', 95]]),
  F('Donut, glazed', 'Sweets & Desserts', 421, 5.7, 47, 24, 1.4, 26, 360, [['1 donut', 75]]),
  F('Honey', 'Sweets & Desserts', 304, 0.3, 82, 0, 0.2, 82, 4, [['1 tbsp', 21]]),
  F('Sugar', 'Sweets & Desserts', 387, 0, 100, 0, 0, 100, 0, [['1 tsp', 4]]),
  F('Jaggery (gur)', 'Sweets & Desserts', 383, 0.4, 98, 0.1, 0, 97, 27, [['1 tbsp', 12]]),
  F('Jam, fruit', 'Sweets & Desserts', 250, 0.4, 65, 0.1, 1, 49, 30, [['1 tbsp', 20]]),

  // Drinks
  F('Chai with milk + sugar', 'Drinks', 55, 1.6, 8, 1.6, 0, 7.5, 30, [['1 cup', 200]], 'tea'),
  F('Black coffee', 'Drinks', 2, 0.3, 0, 0, 0, 0, 5, [['1 cup', 240]]),
  F('Coffee with milk + sugar', 'Drinks', 45, 1.4, 7, 1.2, 0, 6.5, 28, [['1 cup', 200]]),
  F('Green tea, unsweetened', 'Drinks', 1, 0, 0.2, 0, 0, 0, 1, [['1 cup', 240]]),
  F('Orange juice, fresh', 'Drinks', 45, 0.7, 10, 0.2, 0.2, 8.4, 1, [['1 glass', 250]]),
  F('Cola', 'Drinks', 42, 0, 10.6, 0, 0, 10.6, 4, [['1 can', 330]], 'coke pepsi soda'),
  F('Energy drink', 'Drinks', 45, 0, 11, 0, 0, 11, 100, [['1 can', 250]]),
  F('Coconut water', 'Drinks', 19, 0.7, 3.7, 0.2, 1.1, 2.6, 105, [['1 glass', 250]]),
  F('Sugarcane juice', 'Drinks', 73, 0.2, 18, 0, 0, 17, 5, [['1 glass', 250]], 'ganna'),
  F('Mango shake / smoothie', 'Drinks', 95, 2.8, 16, 2.4, 0.8, 14, 45, [['1 glass', 250]]),
  F('Protein shake (with milk)', 'Drinks', 120, 15, 10, 2.5, 1, 8, 120, [['1 glass', 300]]),

  // Oils & Condiments
  F('Vegetable oil', 'Oils & Condiments', 884, 0, 0, 100, 0, 0, 0, [['1 tbsp', 14]]),
  F('Olive oil', 'Oils & Condiments', 884, 0, 0, 100, 0, 0, 2, [['1 tbsp', 14]]),
  F('Coconut oil', 'Oils & Condiments', 862, 0, 0, 100, 0, 0, 0, [['1 tbsp', 14]]),
  F('Mustard oil', 'Oils & Condiments', 884, 0, 0, 100, 0, 0, 0, [['1 tbsp', 14]]),
  F('Tomato ketchup', 'Oils & Condiments', 112, 1.3, 27, 0.1, 0.3, 22, 907, [['1 tbsp', 17]]),
  F('Mayonnaise', 'Oils & Condiments', 680, 1, 0.6, 75, 0, 0.6, 635, [['1 tbsp', 14]]),
  F('Mango pickle', 'Oils & Condiments', 150, 1.5, 10, 12, 2, 5, 1200, [['1 tbsp', 15]], 'achar'),
  F('Green chutney', 'Oils & Condiments', 45, 1.5, 7, 1.5, 2, 3, 400, [['1 tbsp', 15]]),
  F('Soy sauce', 'Oils & Condiments', 53, 8, 4.9, 0.6, 0.8, 0.4, 5586, [['1 tbsp', 16]]),
  F('Hot sauce', 'Oils & Condiments', 12, 0.5, 1.8, 0.4, 0.3, 1.3, 1243, [['1 tsp', 5]]),
  F('Salad dressing, creamy', 'Oils & Condiments', 330, 1, 9, 32, 0.3, 6, 700, [['1 tbsp', 15]]),
].map((food, index) => ({ id: `f${index}`, ...food }))

// MET-based exercise database: kcal/min = MET × 3.5 × weightKg / 200
export const EXERCISES = [
  { id: 'walk-slow', name: 'Walking, slow (3 km/h)', met: 2.5 },
  { id: 'walk-brisk', name: 'Walking, brisk (5.5 km/h)', met: 4.3 },
  { id: 'jog', name: 'Jogging', met: 7 },
  { id: 'run', name: 'Running (9–10 km/h)', met: 9.8 },
  { id: 'cycle-slow', name: 'Cycling, leisure', met: 4 },
  { id: 'cycle-fast', name: 'Cycling, vigorous', met: 8.5 },
  { id: 'swim', name: 'Swimming, moderate', met: 7 },
  { id: 'yoga', name: 'Yoga', met: 3 },
  { id: 'weights', name: 'Weight training', met: 5 },
  { id: 'hiit', name: 'HIIT', met: 9 },
  { id: 'skip', name: 'Skipping rope', met: 11 },
  { id: 'football', name: 'Football', met: 7 },
  { id: 'cricket', name: 'Cricket (batting/fielding)', met: 4.8 },
  { id: 'badminton', name: 'Badminton', met: 5.5 },
  { id: 'dance', name: 'Dancing, aerobic', met: 6.5 },
  { id: 'stairs', name: 'Climbing stairs', met: 9 },
  { id: 'elliptical', name: 'Elliptical trainer', met: 5 },
  { id: 'rowing', name: 'Rowing machine', met: 7 },
  { id: 'stretch', name: 'Stretching / mobility', met: 2.3 },
  { id: 'housework', name: 'Housework, vigorous', met: 4 },
]

export function foodById(id) {
  return FOODS.find(food => food.id === id)
}

// Small fuzzy-ish match: case-insensitive substring on name + keywords,
// with a score favouring prefix matches.
export function searchFoods(query, pool = FOODS) {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const terms = q.split(/\s+/)
  return pool
    .map(food => {
      const hay = `${food.name} ${food.kw || ''} ${food.cat}`.toLowerCase()
      if (!terms.every(term => hay.includes(term))) return null
      const name = food.name.toLowerCase()
      const score = (name.startsWith(terms[0]) ? 2 : 0) + (name.includes(q) ? 1 : 0)
      return { food, score }
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.food.name.localeCompare(b.food.name))
    .map(hit => hit.food)
}
