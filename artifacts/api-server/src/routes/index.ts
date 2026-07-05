import { Router, type IRouter } from "express";
import healthRouter from "./health";
import profilesRouter from "./profiles";
import studyPlansRouter from "./study-plans";
import dailyTasksRouter from "./daily-tasks";
import syllabusRouter from "./syllabus";
import currentAffairsRouter from "./current-affairs";
import quizRouter from "./quiz";
import progressRouter from "./progress";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(profilesRouter);
router.use(studyPlansRouter);
router.use(dailyTasksRouter);
router.use(syllabusRouter);
router.use(currentAffairsRouter);
router.use(quizRouter);
router.use(progressRouter);
router.use(adminRouter);

export default router;
