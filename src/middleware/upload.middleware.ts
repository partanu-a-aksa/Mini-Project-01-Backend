import multer from "multer";
import path from "path";

export const fileUpload = multer({
  storage: multer.diskStorage({
    destination: (request, file, cb) => {
      cb(null, "public");
    },
    filename: (request, file, cb) => {
      const uniqueName = `BLOGGY-${Date.now}-${file.originalname}`;
      cb(null, uniqueName);
    },
  }),
  fileFilter: (request, file, cb) => {
    const allowedTypes = /jpg|jpeg|png|svg|webp|gif|avif/;
    const extName = path.extname(file.originalname);
    const isTypeValid = allowedTypes.test(extName);

    if (isTypeValid) {
      cb(null, true);
    } else {
      cb(new Error("Only image files allowed"));
    }
  },

  limits: {
    fileSize: 1024 * 1024 * 5,
  },
});
