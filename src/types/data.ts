interface ElementType {
  readonly id: string;
  readonly emoji: string;
}

type RecipeType = readonly [ElementType, ElementType];

interface UseType {
  readonly pair: ElementType;
  readonly result: ElementType;
}

interface StepType {
  readonly a: ElementType;
  readonly b: ElementType;
  readonly result: ElementType;
}

type LineageType = readonly StepType[];

type ShareStepType = readonly [ElementType, ElementType, ElementType];

type ShareLineageType = readonly ShareStepType[];

interface ItemDataType {
  readonly id: number;
  readonly text: string;
  readonly emoji: string;
  readonly use_count: number;
  readonly recipe_count: number;
  readonly depth: number;
}

interface RecipesDataType {
  readonly total: number;
  readonly recipes: RecipeType[];
}

interface UsesDataType {
  readonly total: number;
  readonly uses: UseType[];
}

type LineageMissingInfo = Record<string, "loop" | "no_recipe">;

interface LineageDataType {
  readonly steps: LineageType;
  readonly missing: LineageMissingInfo;
}

type CustomLineageDataType = LineageDataType;

export type {
  ElementType,
  RecipeType,
  UseType,
  StepType,
  LineageType,
  ShareStepType,
  ShareLineageType,
  ItemDataType,
  RecipesDataType,
  UsesDataType,
  LineageMissingInfo,
  LineageDataType,
  CustomLineageDataType,
};
