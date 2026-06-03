const fs = require("fs");
const path = require("path");

const root = process.cwd();

const diagrams = [
  {
    file: "docs/pfe/sprint2_auth/seq_doctor_register.puml",
    name: "Sprint 1 - Inscription médecin",
  },
  {
    file: "docs/pfe/sprint2_auth/seq_edge_login.puml",
    name: "Sprint 1 - Connexion locale Edge",
  },
  {
    file: "docs/pfe/sprint2_auth/seq_patient_registration.puml",
    name: "Sprint 1 - Enregistrement profil patient",
  },
  {
    file: "docs/pfe/sprint2_surveillance/seq_vitals_monitoring.puml",
    name: "Sprint 2 - Surveillance temps réel",
  },
  {
    file: "docs/pfe/sprint2_surveillance/seq_alert_detection.puml",
    name: "Sprint 2 - Détection d'alerte",
  },
  {
    file: "docs/pfe/sprint2_surveillance/seq_vitals_history.puml",
    name: "Sprint 2 - Historique des signes vitaux",
  },
  {
    file: "docs/pfe/sprint2_surveillance/seq_alert_history_filtering.puml",
    name: "Sprint 2 - Historique et filtrage des alertes",
  },
  {
    file: "docs/pfe/sprint3_doctor_space/seq_doctor_patient_consultation.puml",
    name: "Sprint 3 - Consultation patient",
  },
  {
    file: "docs/pfe/sprint3_doctor_space/seq_doctor_ai_report.puml",
    name: "Sprint 3 - Rapport IA",
  },
  {
    file: "docs/pfe/sprint3_doctor_space/seq_doctor_appointment_management.puml",
    name: "Sprint 3 - Gestion des rendez-vous",
  },
  {
    file: "docs/pfe/sprint3_doctor_space/seq_doctor_profile_update.puml",
    name: "Sprint 3 - Mise à jour profil médecin",
  },
];

function idFactory() {
  let counter = 1;
  return () => `ID_${String(counter++).padStart(6, "0")}`;
}

const nextId = idFactory();

function ref(id) {
  return { $ref: id };
}

function parsePuml(filePath) {
  const raw = fs.readFileSync(path.join(root, filePath), "utf8");
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  const participants = [];
  const aliasIndex = new Map();
  const messages = [];

  const declRe =
    /^(actor|boundary|control|entity|database|collections|participant)\s+"([^"]+)"\s+as\s+([A-Za-z_][A-Za-z0-9_]*)$/;
  const msgRe =
    /^([A-Za-z_][A-Za-z0-9_]*)\s+(-+>|-->|->)\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+)$/;
  const replyRe =
    /^([A-Za-z_][A-Za-z0-9_]*)\s+(-->|<--)\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+)$/;

  for (const line of lines) {
    const decl = line.match(declRe);
    if (decl) {
      const [, kind, rawLabel, alias] = decl;
      const label = rawLabel.replace(/\\n/g, " ").trim();
      if (!aliasIndex.has(alias)) {
        aliasIndex.set(alias, participants.length);
        participants.push({ alias, label, kind });
      }
      continue;
    }

    const msg = line.match(msgRe) || line.match(replyRe);
    if (msg) {
      const [, from, arrow, to, rawText] = msg;
      if (!aliasIndex.has(from)) {
        aliasIndex.set(from, participants.length);
        participants.push({ alias: from, label: from, kind: "participant" });
      }
      if (!aliasIndex.has(to)) {
        aliasIndex.set(to, participants.length);
        participants.push({ alias: to, label: to, kind: "participant" });
      }
      messages.push({
        from,
        to,
        text: rawText.replace(/\\n/g, " / ").trim(),
        reply: arrow.includes("--"),
        self: from === to,
      });
    }
  }

  return { participants, messages };
}

function labelView(parentId, modelId, text, left, top, options = {}) {
  const id = nextId();
  return {
    _type: options.edge ? "EdgeLabelView" : "LabelView",
    _id: id,
    _parent: ref(parentId),
    ...(options.edge ? { model: ref(modelId) } : {}),
    ...(options.visible === false ? { visible: false } : {}),
    font: options.bold ? "Arial;13;1" : "Arial;13;0",
    left,
    top,
    width: Math.max(20, text.length * 7),
    height: 13,
    ...(options.edge
      ? {
          alpha: options.alpha ?? Math.PI / 2,
          distance: options.distance ?? 10,
          hostEdge: ref(parentId),
          edgePosition: 1,
        }
      : {}),
    ...(text ? { text } : {}),
    ...(options.horizontalAlignment ? { horizontalAlignment: options.horizontalAlignment } : {}),
  };
}

function buildDiagram(diagramSpec) {
  const parsed = parsePuml(diagramSpec.file);
  const collaborationId = nextId();
  const interactionId = nextId();
  const diagramId = nextId();

  const collaboration = {
    _type: "UMLCollaboration",
    _id: collaborationId,
    _parent: null,
    name: `${diagramSpec.name} Collaboration`,
    ownedElements: [],
    attributes: [],
  };

  const interaction = {
    _type: "UMLInteraction",
    _id: interactionId,
    _parent: ref(collaborationId),
    name: "Interaction1",
    ownedElements: [],
    messages: [],
    participants: [],
  };

  const ownedViews = [];

  const frameId = nextId();
  const frameNameId = nextId();
  const frameTypeId = nextId();
  const participantCount = Math.max(1, parsed.participants.length);
  const frameWidth = Math.max(900, 120 + participantCount * 190);
  const frameHeight = Math.max(500, 160 + parsed.messages.length * 32);

  const frame = {
    _type: "UMLFrameView",
    _id: frameId,
    _parent: ref(diagramId),
    model: ref(diagramId),
    subViews: [
      {
        _type: "LabelView",
        _id: frameNameId,
        _parent: ref(frameId),
        font: "Arial;13;0",
        left: 42,
        top: 13,
        width: Math.max(50, diagramSpec.name.length * 7),
        height: 13,
        text: diagramSpec.name,
      },
      {
        _type: "LabelView",
        _id: frameTypeId,
        _parent: ref(frameId),
        font: "Arial;13;1",
        left: 21,
        top: 13,
        width: 14,
        height: 13,
        text: "sd",
      },
    ],
    font: "Arial;13;0",
    left: 16,
    top: 8,
    width: frameWidth,
    height: frameHeight,
    nameLabel: ref(frameNameId),
    frameTypeLabel: ref(frameTypeId),
  };
  ownedViews.push(frame);

  const lifelineMeta = new Map();
  parsed.participants.forEach((p, index) => {
    const attrId = nextId();
    const lifelineId = nextId();
    const viewId = nextId();
    const nameCompartmentId = nextId();
    const stereoId = nextId();
    const nameId = nextId();
    const namespaceId = nextId();
    const propertyId = nextId();
    const linePartId = nextId();

    const boxWidth = Math.max(80, p.label.length * 7 + 16);
    const left = 64 + index * 190;
    const centerX = left + Math.round(boxWidth / 2);

    collaboration.attributes.push({
      _type: "UMLAttribute",
      _id: attrId,
      _parent: ref(collaborationId),
      name: `Role${index + 1}`,
      type: "",
    });

    interaction.participants.push({
      _type: "UMLLifeline",
      _id: lifelineId,
      _parent: ref(interactionId),
      name: p.label,
      represent: ref(attrId),
      isMultiInstance: false,
    });

    ownedViews.push({
      _type: "UMLSeqLifelineView",
      _id: viewId,
      _parent: ref(diagramId),
      model: ref(lifelineId),
      subViews: [
        {
          _type: "UMLNameCompartmentView",
          _id: nameCompartmentId,
          _parent: ref(viewId),
          model: ref(lifelineId),
          subViews: [
            {
              _type: "LabelView",
              _id: stereoId,
              _parent: ref(nameCompartmentId),
              visible: false,
              font: "Arial;13;0",
              height: 13,
            },
            {
              _type: "LabelView",
              _id: nameId,
              _parent: ref(nameCompartmentId),
              font: "Arial;13;1",
              left: left + 5,
              top: 47,
              width: Math.max(40, p.label.length * 7),
              height: 13,
              text: p.label,
            },
            {
              _type: "LabelView",
              _id: namespaceId,
              _parent: ref(nameCompartmentId),
              visible: false,
              font: "Arial;13;0",
              width: 106,
              height: 13,
              text: "(from Interaction1)",
            },
            {
              _type: "LabelView",
              _id: propertyId,
              _parent: ref(nameCompartmentId),
              visible: false,
              font: "Arial;13;0",
              height: 13,
              horizontalAlignment: 1,
            },
          ],
          font: "Arial;13;0",
          left,
          top: 40,
          width: boxWidth,
          height: 40,
          stereotypeLabel: ref(stereoId),
          nameLabel: ref(nameId),
          namespaceLabel: ref(namespaceId),
          propertyLabel: ref(propertyId),
        },
        {
          _type: "UMLLinePartView",
          _id: linePartId,
          _parent: ref(viewId),
          model: ref(lifelineId),
          font: "Arial;13;0",
          left: centerX,
          top: 80,
          width: 1,
          height: frameHeight - 100,
        },
      ],
      font: "Arial;13;0",
      left,
      top: 40,
      width: boxWidth,
      height: frameHeight - 48,
      nameCompartment: ref(nameCompartmentId),
      linePart: ref(linePartId),
    });

    lifelineMeta.set(p.alias, { lifelineId, linePartId, centerX });
  });

  let y = 120;
  parsed.messages.forEach((m, index) => {
    const modelId = nextId();
    const viewId = nextId();
    const nameId = nextId();
    const stereoId = nextId();
    const propertyId = nextId();
    const activationId = nextId();

    const from = lifelineMeta.get(m.from);
    const to = lifelineMeta.get(m.to);
    const x1 = from.centerX;
    const x2 = to.centerX;

    interaction.messages.push({
      _type: "UMLMessage",
      _id: modelId,
      _parent: ref(interactionId),
      name: m.text,
      source: ref(from.lifelineId),
      target: ref(to.lifelineId),
      ...(m.reply ? { messageSort: "reply" } : {}),
    });

    const labelLeft = m.self ? x1 + 10 : Math.min(x1, x2) + 12;
    const labelTop = y + (m.self ? 4 : -14);
    const activationLeft = m.self ? x1 - 7 : x2 - 7;
    const activationTop = y + 16;
    const activationHeight = m.self ? 28 : 24;
    const points = m.self
      ? `${x1}:${y};${x1 + 30}:${y};${x1 + 30}:${y + 20};${x1 + 7}:${y + 20}`
      : `${x1}:${y};${x2}:${y}`;

    ownedViews.push({
      _type: "UMLSeqMessageView",
      _id: viewId,
      _parent: ref(diagramId),
      model: ref(modelId),
      subViews: [
        {
          _type: "EdgeLabelView",
          _id: nameId,
          _parent: ref(viewId),
          model: ref(modelId),
          font: "Arial;13;0",
          left: labelLeft,
          top: labelTop,
          width: Math.max(50, m.text.length * 7),
          height: 13,
          alpha: Math.PI / 2,
          distance: 10,
          hostEdge: ref(viewId),
          edgePosition: 1,
          text: `${index + 1} : ${m.text}`,
        },
        {
          _type: "EdgeLabelView",
          _id: stereoId,
          _parent: ref(viewId),
          model: ref(modelId),
          visible: false,
          font: "Arial;13;0",
          left: labelLeft + 40,
          top: labelTop - 15,
          height: 13,
          alpha: Math.PI / 2,
          distance: 25,
          hostEdge: ref(viewId),
          edgePosition: 1,
        },
        {
          _type: "EdgeLabelView",
          _id: propertyId,
          _parent: ref(viewId),
          model: ref(modelId),
          visible: false,
          font: "Arial;13;0",
          left: labelLeft + 20,
          top: labelTop + 20,
          height: 13,
          alpha: -Math.PI / 2,
          distance: 10,
          hostEdge: ref(viewId),
          edgePosition: 1,
        },
        {
          _type: "UMLActivationView",
          _id: activationId,
          _parent: ref(viewId),
          model: ref(modelId),
          font: "Arial;13;0",
          left: activationLeft,
          top: activationTop,
          width: 14,
          height: activationHeight,
        },
      ],
      font: "Arial;13;0",
      head: ref(m.self ? from.linePartId : to.linePartId),
      tail: ref(from.linePartId),
      points,
      nameLabel: ref(nameId),
      stereotypeLabel: ref(stereoId),
      propertyLabel: ref(propertyId),
      activation: ref(activationId),
    });

    y += m.self ? 40 : 32;
  });

  const diagram = {
    _type: "UMLSequenceDiagram",
    _id: diagramId,
    _parent: ref(interactionId),
    name: diagramSpec.name,
    showSequenceNumber: true,
    showActivation: true,
    ownedViews,
  };

  interaction.ownedElements.push(diagram);
  collaboration.ownedElements.push(interaction);

  return collaboration;
}

function buildProject() {
  const projectId = nextId();
  const modelId = nextId();
  const mainDiagramId = nextId();

  const project = {
    _type: "Project",
    _id: projectId,
    name: "HealthGuard Sequence Diagrams",
    ownedElements: [
      {
        _type: "UMLModel",
        _id: modelId,
        _parent: ref(projectId),
        name: "Model",
        ownedElements: [
          {
            _type: "UMLClassDiagram",
            _id: mainDiagramId,
            _parent: ref(modelId),
            name: "Main",
            defaultDiagram: true,
          },
        ],
      },
    ],
    documentVersion: 1,
  };

  const model = project.ownedElements[0];
  for (const diagramSpec of diagrams) {
    const collaboration = buildDiagram(diagramSpec);
    collaboration._parent = ref(modelId);
    model.ownedElements.push(collaboration);
  }

  return project;
}

const outPath = process.argv[2] || path.join(root, "docs", "pfe", "sequence-diagrams.mdj");
const project = buildProject();
fs.writeFileSync(outPath, JSON.stringify(project, null, 2), "utf8");
console.log(outPath);
