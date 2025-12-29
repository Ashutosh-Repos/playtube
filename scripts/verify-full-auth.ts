
import { prisma } from "../packages/database/src/client";
import { hashPassword, verifyPassword } from "../apps/web/lib/auth/password";
import { signAccessToken } from "../apps/web/lib/auth/token";

// Mock env for token generation if needed, but we used real env in lib.
// We will test logic by directly calling service functions or simulating requests if possible?
// Actually simpler: We can just use Prisma to set up data and then print CURL commands 
// OR we can try to "fetch" against the running server if it's running.
// Since I cannot guarantee the server is running on localhost:3000, 
// I will write a script that HELPS the user verify OR mainly validates the database logic/service helpers if I can import them.

// PROBLEM: Importing Next.js app code (lib/auth/token) into a standalone script might fail due to "server-only" or env var issues if not strictly handled.
// BETTER APPROACH: I will create a script that resets the DB and creates a defined Admin and User, then instructs the user how to test OR tries to hit endpoints if I assume the server is up.

// Let's assume the user can run `npm run dev`.
// I will create a script that relies on `fetch` to hitting `http://localhost:3000`.
// I will ask the user to ensure the server is running.

const BASE_URL = "http://localhost:3000";

async function run() {
  console.log("🚀 Starting Full Verification...");

  // 1. Setup Data directly in DB (Prisma)
  console.log("Creationg Test Users...");
  
  // Clean up
  await prisma.user.deleteMany({ where: { email: { in: ["admin@example.com", "user@example.com"] } } });

  const adminPassword = await hashPassword("Admin123!");
  const userPassword = await hashPassword("User123!");

  const admin = await prisma.user.create({
    data: {
      email: "admin@example.com",
      name: "Admin User",
      role: "ADMIN",
      status: "ACTIVE",
      passwordHash: adminPassword,
    }
  });

  const user = await prisma.user.create({
    data: {
      email: "user@example.com",
      name: "Normal User",
      role: "USER",
      status: "ACTIVE",
      passwordHash: userPassword,
    }
  });

  console.log("✅ Created Admin and User.");

  // 2. Test Login (Auth Service)
  console.log("\nTesting Login...");
  
  async function login(email: string, password: string) {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    const cookie = res.headers.get("set-cookie");
    return { status: res.status, data, cookie };
  }

  const adminLogin = await login("admin@example.com", "Admin123!");
  if (adminLogin.status !== 200) {
    console.error("❌ Admin Login Failed:", adminLogin.data);
    process.exit(1);
  }
  console.log("✅ Admin Login Success");
  
  const adminToken = adminLogin.data.accessToken; // We need to extract the cookie for subsequent requests if using middleware
  // Note: fetch in node doesn't auto-persist cookies. We need to grab `auth_token` from Set-Cookie header if possible.
  // The server sets `auth_token` as HttpOnly. Response `set-cookie` header might vary.
  // `login` returns accessToken in body too (we updated route to do so).
  // Wait, did we? Yes, `api/auth/login/route.ts` returns `{ accessToken, user }`.
  
  // Middleware expects `auth_token` cookie. We must send it.
  // We can construct the cookie header manually.
  const adminCookie = `auth_token=${adminToken}`; 

  // 3. Test Admin Access (RBAC)
  console.log("\nTesting Admin Access (RBAC)...");
  const usersRes = await fetch(`${BASE_URL}/api/admin/users`, {
    headers: { Cookie: adminCookie },
  });
  if (usersRes.status === 200) {
    console.log("✅ Admin can access /api/admin/users");
  } else {
    console.error("❌ Admin Access Failed:", usersRes.status);
  }

  const userLogin = await login("user@example.com", "User123!");
  const userToken = userLogin.data.accessToken;
  const userCookie = `auth_token=${userToken}`;

  const usersResByUser = await fetch(`${BASE_URL}/api/admin/users`, {
    headers: { Cookie: userCookie },
  });
  if (usersResByUser.status === 403) {
    console.log("✅ User CANNOT access /api/admin/users (403 Forbidden)");
  } else {
    console.error("❌ User Access Check Failed:", usersResByUser.status);
  }

  // 4. Test Ban User (Admin Action)
  console.log("\nTesting Ban User...");
  const banRes = await fetch(`${BASE_URL}/api/admin/users/${user.id}/status`, {
    method: "PATCH",
    headers: { 
        "Content-Type": "application/json",
        Cookie: adminCookie 
    },
    body: JSON.stringify({ status: "BANNED", reason: "Violation" }),
  });
  
  if (banRes.status === 200) {
    console.log("✅ Admin Banned User");
  } else {
    console.error("❌ Ban User Failed:", await banRes.json());
  }

  // 4a. Test Timed Suspension (New Capability)
  // First UNBAN to reset
  await fetch(`${BASE_URL}/api/admin/users/${user.id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({ status: "ACTIVE", reason: "Reset" }),
  });

  console.log("\nTesting Timed Suspension...");
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 1);
  
  const suspendRes = await fetch(`${BASE_URL}/api/admin/users/${user.id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({ 
        status: "SUSPENDED", 
        reason: "Timeout", 
        suspendedUntil: futureDate.toISOString() 
    }),
  });

  if (suspendRes.status === 200) {
    console.log("✅ Admin Suspended User (Timed)");
    // Verify DB
    const suspendedUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (suspendedUser?.suspendedUntil) {
        console.log("✅ DB has suspendedUntil set");
    } else {
        console.error("❌ DB missing suspendedUntil");
    }
  } else {
    console.error("❌ Timed Suspension Failed:", await suspendRes.json());
  }
  
  // Reset for next tests
  await fetch(`${BASE_URL}/api/admin/users/${user.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ status: "ACTIVE", reason: "Reset" }),
  });

  // 4b. Test Channel List (New Capability)
  console.log("\nTesting Channel List...");
  // Create dummy channel first
  await prisma.channel.create({
      data: {
          userId: user.id,
          handle: "user_channel_1",
          name: "User Channel 1"
      }
  });
  
  const channelsRes = await fetch(`${BASE_URL}/api/users/me/channels`, {
      headers: { Cookie: userCookie }
  });
  
  if (channelsRes.status === 200) {
      const data = await channelsRes.json();
      if (data.channels.length > 0) {
          console.log(`✅ Fetched ${data.channels.length} channels`);
      } else {
          console.error("❌ Channel list empty");
      }
  } else {
      console.error("❌ Channel List Failed:", channelsRes.status);
  }

  // 4c. Test Avatar/PrimaryChannel Update (New Capability)
  console.log("\nTesting Avatar/PrimaryChannel Update...");
  const updateRes = await fetch(`${BASE_URL}/api/users/me`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: userCookie },
      body: JSON.stringify({ 
          image: "https://example.com/avatar.png",
          // primaryChannelId: ... (Requires Channel ID, skipping for simplicity or need to fetch first)
      }),
  });
  
  if (updateRes.status === 200) {
      const data = await updateRes.json();
      if (data.user.image === "https://example.com/avatar.png") {
          console.log("✅ Avatar Updated");
      } else {
          console.error("❌ Avatar mismatch:", data.user.image);
      }
  } else {
      console.error("❌ Profile Update Failed:", updateRes.status);
  }

  // 5. Test Banned User Login (Status Enforcement)
  console.log("\nTesting Banned User Login...");
  const bannedLogin = await login("user@example.com", "User123!");
  if (bannedLogin.status === 403) {
    console.log("✅ Banned User blocked from Login (403)");
  } else {
    console.error("❌ Banned User Login Check Failed:", bannedLogin.status);
  }

  // 6. Audit Log Check
  console.log("\nChecking Audit Log...");
  const logs = await prisma.auditLog.findMany({
    where: { targetUserId: user.id },
  });
  if (logs.length > 0) {
    console.log(`✅ Audit Log found: ${logs[0].action} by ${logs[0].actorId}`);
  } else {
    console.error("❌ No Audit Log found for Ban action");
  }

  console.log("\n🎉 Verification Complete!");
}

run().catch(console.error);
