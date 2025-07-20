/**
   Функция для расчета прибыли
  @param {object} purchase — запись о покупке
  @param {object} _product — карточка товара
  @returns {number} — прибыль от продажи
 */

//Расчет прибыли от операции
function calculateSimpleRevenue(purchase, _product) {
   const { discount, sale_price, quantity } = purchase;
   const decimalDiscount = discount / 100;
   const totalPrice = sale_price * quantity;
   const revenue = totalPrice * (1 - decimalDiscount);
   return revenue;
}

/**
  Функция для расчета бонусов
  @param index порядковый номер в отсортированном массиве
  @param total общее число продавцов
  @param seller карточка продавца
  @returns {number}
 */

// @TODO: Расчет бонуса от позиции в рейтинге
function calculateBonusByProfit(index, total, seller) {
   const { profit } = seller; //локальная переменная, используем profit для вычаслений

   if (index === 0) {
      return seller.profit * 0.15;
   } else if (index === 1 || index === 2) {
      return seller.profit * 0.1;
   } else if (index < total - 1) {
      return seller.profit * 0.05;
   } else {
      return 0;
   }
}

/**
   Функция для анализа данных продаж
  @param data
  @param options
  @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
//Главная функция анализа продаж
function analyzeSalesData(data, options) {
   // 1. Проверка входных данных
   if (!data 
    || !Array.isArray(data.sellers) 
    || data.sellers.length === 0 
    || !Array.isArray(data.products) 
    || data.products.length === 0 
    || !Array.isArray(data.purchase_records) 
    || data.purchase_records.length === 0) {
      throw new Error("Ошибка: входные данные должны содержать массивы sellers, products и purchase_records");
   }
   //* console.log("Входные данные валидны и содержат массивы с элементами");

   // 2. Проверка наличий опций - функций расчета
   const { calculateRevenue, calculateBonus } = options;

   if (typeof calculateRevenue !== "function" || typeof calculateBonus !== "function") {
      throw new Error("Ошибка: calculateRevenue и calculateBonus должны быть функциями");
   }
   //* console.log("Функции calculateRevenue и calculateBonus переданы корректно");

   // 3. Индексация продавцов и товаров для быстрого доступа
   const sellerById = data.sellers.reduce((acc, seller) => {
      acc[seller.id] = seller;
      return acc;
   }, {});
   //*console.log(sellerById['seller_5'].position);
   
   const productBySku = data.products.reduce((acc, product) => {
      acc[product.sku] = product;
      return acc;
   }, {});
   //*console.log(productBySku['SKU_002'].name);

   // 4. Подготовка промежуточных данных для сбора статистики
   const sellerStats = data.sellers.reduce((acc, seller) => {
      acc[seller.id] = {
         seller_id: seller.id,
         name: `${seller.first_name} ${seller.last_name}`,
         revenue: 0,
         profit: 0,
         sales_count: 0,
         products_sold: {},
      };
      return acc;
   }, {});

   const sellerIndex = sellerStats; // Ключом будет id, значением — запись из sellerStats
   const productIndex = productBySku; // Ключом будет sku, значением — запись из data.products

   // 5. Расчет выручки и прибыли для каждого продавца
   for (const record of data.purchase_records) {
      const sellerId = record.seller_id;
      if (!sellerById[sellerId]) continue;
      // Инициализация статистики по продавцу при первом упоминании
      if (!sellerStats[sellerId]) {
         const seller = sellerById[sellerId];
         sellerStats[sellerId] = {
            seller_id: sellerId,
            name: `${seller.first_name} ${seller.last_name}`,
            revenue: 0, // Общая выручка продавца
            profit: 0, // Общая прибыль продавца
            sales_count: 0, // Количество проданных единиц
            products_sold: {}, // Сколько каких товаров продано
         };
         //*console.log(`🧾 Создана карточка продавца: ${sellerStats[sellerId].name}`);
      }
      //Перебор купленных товаров в чеке
      for (const item of record.items) {
         const product = productBySku[item.sku];
         if (!product) continue; // если товар не найден — пропускаем

         // Вычисляем выручку и прибыль по товару
         const revenue = calculateRevenue(item, product);
         const profit = revenue - product.purchase_price * item.quantity;

         // Обновляем накопленные значения статистики продавца
         const stats = sellerStats[sellerId];
         stats.revenue += revenue; // Добавляем выручку
         stats.profit += profit; // Добавляем прибыль
         stats.sales_count += item.quantity; // Добавляем кол-во проданных единиц

         //Учитываем, сколько штук этого товара продано
         if (!stats.products_sold[item.sku]) {
            stats.products_sold[item.sku] = 0;
         }
         stats.products_sold[item.sku] += item.quantity;
      }
   }

   // 6. Преобразуем статистику в массив для сортировки
   const sellersArray = Object.values(sellerStats);

   // 7. Сортировка продавцов по убыванию прибыли
   sellersArray.sort((a, b) => b.profit - a.profit);

   // 8. Назначение премий на основе ранжирования
   for (let i = 0; i < sellersArray.length; i++) {
      const seller = sellersArray[i];
      seller.bonus = calculateBonus(i, sellersArray.length, seller);

      seller.top_products = Object.entries(seller.products_sold)
         .map(([sku, quantity]) => ({ sku, quantity })) // из массива [[sku, quantity]] в [{sku, quantity}]
         .sort((a, b) => b.quantity - a.quantity) // сортируем по убыванию количества
         .slice(0, 10);
   }

   // 9. Подготовка итоговой коллекции с нужными полями
   return sellersArray.map((seller) => ({
      seller_id: seller.seller_id,
      name: seller.name,
      revenue: +seller.revenue.toFixed(2), // Округляем выручку до 2 знаков после запятой и преобразуем в число
      profit: +seller.profit.toFixed(2),
      sales_count: seller.sales_count, // Количество совершённых продаж
      top_products: seller.top_products,
      bonus: +seller.bonus.toFixed(2),
   }));
}
