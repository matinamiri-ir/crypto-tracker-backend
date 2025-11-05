import app from "./app";
import { connectDB } from "./db";

const port = process.env.PORT || 3120;

connectDB().then(() => {
  app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
});
