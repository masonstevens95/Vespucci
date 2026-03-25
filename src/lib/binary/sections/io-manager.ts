import { TokenReader } from "../token-reader";
import { BinaryToken, isValueToken } from "../tokens";
import { T } from "../game-tokens";

/** Pure predicate: is this a lordship IO type? */
const isLordshipType = (type: string): boolean =>
  type === "loc" || type === "autocephalous_patriarchate";

/** Mutates overlordSubjects and ioMatched to register a subject relationship. */
const addSubject = (
  overlordSubjects: Record<string, Set<string>>,
  ioMatched: Set<string>,
  leaderTag: string,
  subjectTag: string,
): void => {
  if (!overlordSubjects[leaderTag]) {
    overlordSubjects[leaderTag] = new Set();
  } else {
    /* set already exists */
  }
  overlordSubjects[leaderTag].add(subjectTag);
  ioMatched.add(subjectTag);
};

/** Read IO manager for type=loc subject relationships. */
export const readIOManager = (
  r: TokenReader,
  countryTags: Record<number, string>,
  overlordSubjects: Record<string, Set<string>>,
  ioMatched: Set<string>,
): void => {
  let depth = 1;
  while (!r.done && depth > 0) {
    const tok = r.readToken();
    if (tok === BinaryToken.CLOSE) {
      depth--;
      continue;
    } else if (tok === BinaryToken.OPEN) {
      depth++;
      continue;
    } else if (tok === BinaryToken.EQUAL) {
      continue;
    } else {
      /* field token — check what it is */
    }

    if (tok === T.database) {
      r.expectEqual();
      r.expectOpen();
      readIOEntries(r, countryTags, overlordSubjects, ioMatched);
    } else if (r.peekToken() === BinaryToken.EQUAL) {
      r.readToken();
      r.skipValue();
    } else {
      /* unrecognized token without trailing =, skip */
    }
  }
};

/** Read all IO entries from the database block. */
export const readIOEntries = (
  r: TokenReader,
  countryTags: Record<number, string>,
  overlordSubjects: Record<string, Set<string>>,
  ioMatched: Set<string>,
): void => {
  while (!r.done) {
    const tok = r.peekToken();
    if (tok === BinaryToken.CLOSE) {
      r.readToken();
      return;
    } else {
      /* not end of block — process entry */
    }

    if (tok === BinaryToken.I32 || tok === BinaryToken.U32) {
      r.readToken();
      if (tok === BinaryToken.I32) {
        r.readI32();
      } else {
        r.readU32();
      }
      r.expectEqual();
      if (r.expectOpen()) {
        readIOEntry(r, countryTags, overlordSubjects, ioMatched);
      } else {
        r.skipValue(); // non-block entry (e.g., "ID = none")
      }
    } else {
      r.readToken();
      if (r.peekToken() === BinaryToken.EQUAL) {
        r.readToken();
        r.skipValue();
      } else {
        /* no trailing =, nothing to skip */
      }
    }
  }
};

/**
 * Read a single IO entry. Uses two-pass for reliable parsing.
 * If type is lordship (loc/autocephalous_patriarchate), records subjects.
 */
export const readIOEntry = (
  r: TokenReader,
  countryTags: Record<number, string>,
  overlordSubjects: Record<string, Set<string>>,
  ioMatched: Set<string>,
): void => {
  // Pass 1: find field offsets
  const startPos = r.pos;
  r.skipBlock();
  const endPos = r.pos;

  let typeOffset = -1;
  let leaderOffset = -1;
  let membersOffset = -1;

  r.pos = startPos;
  let depth = 1;
  while (r.pos < endPos && depth > 0) {
    const fieldPos = r.pos;
    const tok = r.readToken();
    if (tok === BinaryToken.CLOSE) {
      depth--;
      continue;
    } else if (tok === BinaryToken.OPEN) {
      depth++;
      continue;
    } else if (tok === BinaryToken.EQUAL) {
      continue;
    } else if (isValueToken(tok)) {
      r.skipValuePayload(tok);
      continue;
    } else {
      /* field key token — check below */
    }

    if (depth === 1 && r.peekToken() === BinaryToken.EQUAL) {
      if (tok === T.type || tok === T.TYPE_ENGINE) {
        typeOffset = fieldPos;
      } else if (tok === T.leader) {
        leaderOffset = fieldPos;
      } else if (tok === T.allMembers) {
        membersOffset = fieldPos;
      } else {
        /* unrecognized field, skip */
      }
      r.readToken(); // =
      r.skipValue();
    } else {
      /* not a depth-1 field assignment, skip */
    }
  }

  // Pass 2: read values (sentinels instead of null)
  const ioTypeName: string = typeOffset >= 0
    ? (r.pos = typeOffset, r.readToken(), r.expectEqual(), r.readStringValue() ?? "")
    : "";

  const ioLeader: number = leaderOffset >= 0
    ? (r.pos = leaderOffset, r.readToken(), r.expectEqual(), r.readIntValue() ?? -1)
    : -1;

  const ioMembers: number[] = [];
  if (membersOffset >= 0) {
    r.pos = membersOffset;
    r.readToken();
    r.expectEqual();
    r.expectOpen();
    while (!r.done && r.peekToken() !== BinaryToken.CLOSE) {
      const val = r.readIntValue() ?? -1;
      if (val !== -1) {
        ioMembers.push(val);
      } else {
        /* sentinel value, skip this member */
      }
    }
    if (!r.done) {
      r.readToken(); // }
    } else {
      /* reader exhausted before closing brace */
    }
  } else {
    /* no members offset found */
  }

  r.pos = endPos;

  // Check for lordship IO
  const leaderTag = countryTags[ioLeader] ?? "";
  if (isLordshipType(ioTypeName) && ioLeader !== -1 && leaderTag !== "") {
    for (const mid of ioMembers) {
      const subjectTag = countryTags[mid] ?? "";
      if (mid !== ioLeader && subjectTag !== "") {
        addSubject(overlordSubjects, ioMatched, leaderTag, subjectTag);
      } else {
        /* member is the leader itself or has no tag */
      }
    }
  } else {
    /* not a lordship entry or no valid leader */
  }
};
