export type GeneratorShift = "FIRST" | "SECOND";

export type GeneratorSlot = {
  weekday: number;
  lessonIndex: number;
  startTime: string;
  endTime: string;
};

export type GeneratorClass = {
  id: string;
  label: string;
  shift: GeneratorShift;
  slots: GeneratorSlot[];
};

export type GeneratorTeacher = {
  id: string;
  name: string;
};

export type GeneratorRoom = {
  id: string;
  name: string;
};

export type GeneratorRequest = {
  id: string;
  classId: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  roomId: string | null;
  hours: number;
  allowedDays: number[];
};

export type PlacedLesson = {
  requestId: string;
  classId: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  roomId: string | null;
  weekday: number;
  lessonIndex: number;
  startTime: string;
  endTime: string;
  shift: GeneratorShift;
};

export type UnplacedLesson = {
  requestId: string;
  classId: string;
  subjectName: string;
  teacherId: string;
  reason: string;
  suggestion: string;
};

export type GeneratorInput = {
  classes: GeneratorClass[];
  teachers: GeneratorTeacher[];
  rooms: GeneratorRoom[];
  requests: GeneratorRequest[];
  seed?: number;
  maxIterations?: number;
  timeBudgetMs?: number;
  maxSameSubjectPerDay?: number;
};

export type GeneratorResult = {
  placed: PlacedLesson[];
  unplaced: UnplacedLesson[];
  iterations: number;
  timedOut: boolean;
  seed: number;
};
