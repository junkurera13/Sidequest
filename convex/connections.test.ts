/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

function identity(name: string) {
  return {
    subject: name.toLocaleLowerCase(),
    issuer: "https://sidequest.test",
    tokenIdentifier: `https://sidequest.test|${name.toLocaleLowerCase()}`,
    name,
  };
}

describe("identity-aware connections", () => {
  test("a named person stays private until they accept an invitation", async () => {
    const t = convexTest(schema, modules);
    const alice = t.withIdentity(identity("Alice"));
    const bob = t.withIdentity(identity("Bob"));
    const charlie = t.withIdentity(identity("Charlie"));

    await alice.mutation(api.accounts.ensureCurrent, {
      displayName: "Alice",
    });
    await bob.mutation(api.accounts.ensureCurrent, { displayName: "Bob" });
    await charlie.mutation(api.accounts.ensureCurrent, {
      displayName: "Charlie",
    });

    const bobReferenceId = await alice.mutation(api.people.create, {
      displayName: "Bobby",
      relationship: "Childhood friend",
    });
    const token = "alice_invites_bob_0123456789_ABCDEFGHIJKLMNO";
    await alice.mutation(api.connections.createInvite, {
      personReferenceId: bobReferenceId,
      token,
    });
    await expect(
      alice.mutation(api.connections.createInvite, {
        personReferenceId: bobReferenceId,
        token: "second_invite_for_bob_0123456789_ABCDEFGHIJKLM",
      }),
    ).rejects.toThrow("already waiting");

    expect(await alice.query(api.connections.listAccepted)).toEqual([]);
    expect(await charlie.query(api.people.listMine)).toEqual([]);
    expect(await t.query(api.connections.previewInvite, { token })).toMatchObject({
      inviterName: "Alice",
      status: "pending",
    });

    const connectionId = await bob.mutation(api.connections.acceptInvite, {
      token,
    });
    const aliceTogether = await alice.query(api.connections.listAccepted);
    const bobTogether = await bob.query(api.connections.listAccepted);
    expect(aliceTogether).toHaveLength(1);
    expect(aliceTogether[0]?.person.displayName).toBe("Bob");
    expect(bobTogether).toHaveLength(1);
    expect(bobTogether[0]?.person.displayName).toBe("Alice");

    const alicePeople = await alice.query(api.people.listMine);
    const bobPeople = await bob.query(api.people.listMine);
    expect(alicePeople[0]).toMatchObject({
      displayName: "Bob",
      identityAccountId: aliceTogether[0]?.person._id,
    });
    expect(bobPeople[0]).toMatchObject({
      displayName: "Alice",
      identityAccountId: bobTogether[0]?.person._id,
    });

    await alice.mutation(api.sharedExperiences.remember, {
      connectionId,
      title: "Night cycling in Fukuoka",
    });
    expect(
      await bob.query(api.sharedExperiences.listForConnection, {
        connectionId,
      }),
    ).toMatchObject([{ title: "Night cycling in Fukuoka" }]);
    await expect(
      charlie.query(api.sharedExperiences.listForConnection, { connectionId }),
    ).rejects.toThrow("Connection not found");
  });

  test("an invitation cannot connect its creator to themself", async () => {
    const t = convexTest(schema, modules);
    const alice = t.withIdentity(identity("Alice"));
    await alice.mutation(api.accounts.ensureCurrent, {
      displayName: "Alice",
    });
    const personReferenceId = await alice.mutation(api.people.create, {
      displayName: "Someone",
    });
    const token = "alice_self_invite_0123456789_ABCDEFGHIJKLMNOP";
    await alice.mutation(api.connections.createInvite, {
      personReferenceId,
      token,
    });

    await expect(
      alice.mutation(api.connections.acceptInvite, { token }),
    ).rejects.toThrow("own invitation");
    expect(await alice.query(api.connections.listAccepted)).toEqual([]);
  });
});
