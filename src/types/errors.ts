export interface UknownElement {
  readonly code: 404;
  readonly message: "Unknown element";
}

export interface InvalidElementId {
  readonly code: 400;
  readonly message: "Invalid element ID";
}
