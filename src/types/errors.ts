type InfinibrowserError<Code extends number, Message extends string> = {
  readonly code: Code;
  readonly message: Message;
};

type UknownElementError = InfinibrowserError<404, "Unknown element">;

type InvalidElementIdError = InfinibrowserError<400, "Invalid element ID">;

type NotSoFastError = InfinibrowserError<429, "Not so fast!">;

export type {
  InfinibrowserError,
  UknownElementError,
  InvalidElementIdError,
  NotSoFastError,
};
