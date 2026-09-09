import { Request, Response } from "express";
import { importUsersQueue } from "../../helpers/importQueue";

const MAX_IMPORT_SIZE = 500;

export const importUsers = async (req: Request, res: Response) => {
  try {
    const { data }: any = req.body;

    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).send({ message: "The uploaded file is empty." });
    }

    if (data.length > MAX_IMPORT_SIZE) {
      return res.status(400).send({
        message: `Import limited to ${MAX_IMPORT_SIZE} users per batch. You uploaded ${data.length}.`,
      });
    }

    const requestedBy = req.user?.id;

    const job = await importUsersQueue.add(
      "process",
      { data, requestedBy },
      {
        attempts: 1,
        removeOnComplete: 50,
        removeOnFail: 200,
      }
    );

    return res.status(202).send({
      message:
        "Import started in the background. You will be notified once it finishes.",
      jobId: job.id,
    });
  } catch (error: any) {
    console.error("importUsers enqueue error:", error);
    return res
      .status(500)
      .send({ message: "Could not start the import. Please try again." });
  }
};