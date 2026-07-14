import { describe, expect, it } from "vitest";
import { scaledAvatarDimensions } from "./avatar-client";

describe("scaledAvatarDimensions", () => {
  it("reduz o maior lado para 1024 px preservando a proporção", () => {
    expect(scaledAvatarDimensions(4000, 3000)).toEqual({ width: 1024, height: 768 });
    expect(scaledAvatarDimensions(2000, 4000)).toEqual({ width: 512, height: 1024 });
  });

  it("não amplia imagens menores", () => {
    expect(scaledAvatarDimensions(600, 400)).toEqual({ width: 600, height: 400 });
  });
});
