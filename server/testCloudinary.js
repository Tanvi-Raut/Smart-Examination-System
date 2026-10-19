require("dotenv").config();
const { cloudinary, isCloudinaryConfigured, uploadStudentImage, deleteStudentImage } = require("./config/cloudinary");

async function runTest() {
    console.log("=========================================");
    console.log("   CLOUDINARY CONFIGURATION TEST RUNNER  ");
    console.log("=========================================\n");

    console.log("1. Checking Environment Variables...");
    console.log("   Cloud Name  :", process.env.CLOUDINARY_CLOUD_NAME || "Not set");
    console.log("   API Key     :", process.env.CLOUDINARY_API_KEY ? "Configured (" + process.env.CLOUDINARY_API_KEY.slice(-4) + ")" : "Not set");
    console.log("   API Secret  :", process.env.CLOUDINARY_API_SECRET ? "Configured (Hidden)" : "Not set");
    console.log("   Is Fully Configured?:", isCloudinaryConfigured() ? "YES" : "NO");

    if (!isCloudinaryConfigured()) {
        console.error("\n❌ Cloudinary environment variables are missing or incomplete in server/.env");
        process.exit(1);
    }

    try {
        console.log("\n2. Pinging Cloudinary API...");
        const pingResult = await cloudinary.api.ping();
        console.log("   API Status:", pingResult.status);
        console.log("   Rate Limit Remaining:", pingResult.rate_limit_remaining);

        console.log("\n3. Testing Sample Photo Upload to Cloudinary...");
        // 1x1 transparent PNG / GIF sample buffer
        const sampleBuffer = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
        const uploadResult = await uploadStudentImage(sampleBuffer, "test_verification.jpg", "smart_exam_students");
        console.log("   Upload Status : SUCCESS");
        console.log("   Provider      :", uploadResult.provider);
        console.log("   Secure URL    :", uploadResult.url);
        console.log("   Public ID     :", uploadResult.public_id);

        console.log("\n4. Testing Cleanup / Deletion of Sample Image...");
        const deleteResult = await deleteStudentImage(uploadResult.public_id);
        console.log("   Delete Status :", deleteResult.result || "Cleaned up");

        console.log("\n=========================================");
        console.log("✅ ALL CLOUDINARY TESTS PASSED SUCCESSFULLY!");
        console.log("=========================================\n");
    } catch (err) {
        console.error("\n❌ Cloudinary test failed with error:", err.message);
    }
}

runTest();
