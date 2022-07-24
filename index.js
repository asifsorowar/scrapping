let request = require("request");
const cheerio = require("cheerio");
const { promisify } = require("util");
request = promisify(request);
const fs = require("fs");

let url =
  "https://www.otomoto.pl/ciezarowe/uzytkowe/mercedes-benz/od-+2014/q-actros?search%5Bfilter_enum_damaged%5D=0&search%5Border%5D=created_at+%3Adesc";

let pagesData = {};
let page = 1;
let lastPage;

const insertData = (data, key) => {
  let value = pagesData[`page_${page}`];
  if (!value) {
    pagesData[`page_${page}`] = {
      [key]: data,
    };
  } else {
    pagesData[`page_${page}`] = {
      ...value,
      [key]: data,
    };
  }
};

const getNextPageUrl = async ($) => {
  if (!lastPage) {
    let last = $(".pagination-list > li > a").children("span").last().text();
    lastPage = parseInt(last);
  }

  if (page === lastPage) {
    return writeCSV();
  }

  page++;

  if (url.includes("&page=")) {
    url = url.replace(`&page=${page - 1}`, `&page=${page}`);
  } else {
    url += `&page=${page}`;
  }

  return await scraping();
};

const addItems = (article, items) => {
  let id = article.attr("id");
  let href = article.children("div").first().find("a").attr("href");

  return { id, href };
};

const getTotalAdsCount = (items) => {
  return items.length;
};

const scrapeTruckItem = ($, article) => {
  let title = article.children("div").first().find("a").text();
  let price = article.find(".e1b25f6f9.ooa-1w7uott-Text.eu5v0x0 span").text();

  let lis = article
    .children("div")
    .first()
    .find("ul li")
    .map((i, el) => $(el).text())
    .toArray();

  lis = [...new Set(lis)];

  let productionYear = lis[0];
  let mileage = lis[1];
  let power = lis.length > 3 ? lis[2] : "";
  let fuel = lis[lis.length - 1];

  return {
    title,
    price,
    productionYear,
    mileage,
    power,
    fuel,
  };
};

function writeCSV() {
  console.log("total pages:::", page);

  let writeStream = fs.createWriteStream("data.csv");
  for (let key of Object.keys(pagesData)) {
    writeStream.write("Page, Total Adds\n");
    writeStream.write(`${key}, ${pagesData[key].totalAdds}\n`);

    writeStream.write(
      `ID, Title, Price, ProductionYear, Mileage, Power, Fuel, Link\n`
    );

    for (let item of pagesData[key].items) {
      if (item.title) {
        item.title = item.title.replaceAll(",", " | ");
        writeStream.write(
          `${item.id},${item.title},${item.price},${item.productionYear},${item.mileage},${item.power},${item.fuel}, ${item.href}\n`
        );
      }
    }
    writeStream.write(`\n`);
  }

  console.log("scrapping end!!!");
  console.log("-----Check data.csv file--------");
}

let scraping = async () => {
  try {
    console.log(`Page:::`, page);
    console.log(url);
    console.log("------");

    const { body } = await request(url);
    const $ = cheerio.load(body);

    // Getting the Ads: <cheerio>List
    let articles = $("main article");
    let items = [];
    articles.each(async (i, el) => {
      let article = $(el);

      let adData1 = addItems(article);
      let adData2 = scrapeTruckItem($, article);

      if (adData2.title) items.push({ ...adData1, ...adData2 });
    });

    let adsCount = getTotalAdsCount(items);
    insertData(adsCount, "totalAdds");

    insertData(items, "items");

    await getNextPageUrl($);
  } catch (error) {
    console.log(error);
  }
};

scraping();
