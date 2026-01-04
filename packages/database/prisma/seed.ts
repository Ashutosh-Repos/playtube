import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CATEGORIES = [
  { name: "Film & Animation", slug: "film-animation", iconUrl: "film" },
  { name: "Autos & Vehicles", slug: "autos-vehicles", iconUrl: "car" },
  { name: "Music", slug: "music", iconUrl: "music" },
  { name: "Pets & Animals", slug: "pets-animals", iconUrl: "dog" },
  { name: "Sports", slug: "sports", iconUrl: "trophy" },
  { name: "Travel & Events", slug: "travel-events", iconUrl: "plane" },
  { name: "Gaming", slug: "gaming", iconUrl: "gamepad" },
  { name: "People & Blogs", slug: "people-blogs", iconUrl: "users" },
  { name: "Comedy", slug: "comedy", iconUrl: "smile" },
  { name: "Entertainment", slug: "entertainment", iconUrl: "clapperboard" },
  { name: "News & Politics", slug: "news-politics", iconUrl: "newspaper" },
  { name: "Howto & Style", slug: "howto-style", iconUrl: "shirt" },
  { name: "Education", slug: "education", iconUrl: "graduation-cap" },
  { name: "Science & Technology", slug: "science-technology", iconUrl: "flask" },
  { name: "Nonprofits & Activism", slug: "nonprofits-activism", iconUrl: "heart" },
];

async function main() {
  console.log("Start seeding categories...");

  for (const category of CATEGORIES) {
    const existingcat = await prisma.category.findUnique({
      where: { slug: category.slug },
    });

    if (!existingcat) {
      await prisma.category.create({
        data: {
            ...category,
            description: `Videos about ${category.name}`,
        },
      });
      console.log(`Created category: ${category.name}`);
    } else {
      console.log(`Category already exists: ${category.name}`);
    }
  }

  console.log("Seeding finished.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
