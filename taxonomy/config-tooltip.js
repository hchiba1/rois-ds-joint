{
  node: {
    caption: ['name', 'name_ja'],
    defaultIcon: true,
    // title: (n) => blitzboard.createTitle(n) + (n.thumbnail ? `<img width=200 src='${n.thumbnail}'>` : ''),
    title: (n) => {
      return createTitle(n);
      function createTitle(elem) {
        // let idText = `<tr><td><b><a target"_blank" href="http://identifiers.org/taxonomy/${elem.id}">${elem.id}</a></b></td><td><b>${elem.name}</b></td></tr>`;
        let idText = `<tr><td>${elem.id}</td><td><b>${elem.label}</b></td></tr>`;
        Object.entries(elem.properties).forEach(([key, value]) => {
          if (key === 'thumbnail'
              || key === 'tax ID' || key === 'name' || key === 'Wikidata'
             ) {
            // skip
          // } else if (key === 'taxon rank') {
          //   idText += `<tr valign="top"><td>rank</td><td>${value}</td></tr>`;
          // } else if (key === 'taxon name') {
          //   idText += `<tr valign="top"><td>name</td><td>${value}</td></tr>`;
          } else {
            idText += `<tr valign="top"><td>${key}</td><td>${value}</td></tr>`;
          }
        });
        if (n.Wikidata) {
          let wikidata = n.Wikidata;
          const m = wikidata.match(/.*wikidata.org\/entity\/(\S+)$/);
          if (m) {
            wikidata = m[1];
          }
          idText += `<tr><td>Wikidata</td><td><a target"_blank" href="${n.Wikidata}">${wikidata}</a></td></tr>`;
        }
        let img = '';
        if (n.thumbnail) {
          img = `<a target="_blank" href="${n.thumbnail}"><img src="${n.thumbnail}" height="200"></a>`;
        }
        return `<table style='fixed'>${idText}</table>${img}`;
      }
    },
    onDoubleClick: (n) => window.open(n.url, '_blank'),
    onClick: (n) => {
      blitzboard.showLoader();
      // const promiseParent = addParentNode(n.id);
      // const promiseChild = addChildNode(n.id);
      const promiseGroupMembers = addGroupMembers(n.id);
      // Promise.all([promiseParent, promiseChild]).then(() => {
      Promise.all([promiseGroupMembers]).then(() => {
        blitzboard.update();
        blitzboard.hideLoader();
      });

      function addGroupMembers(group) {
        const sparql = sparqlGroupMembers(group);
        const promise = fetch(`https://orth.dbcls.jp/sparql?query=${encodeURIComponent(sparql)}&format=json`).then(res => {
          return res.json();
        }).then(result => {
          for (let elem of result.results.bindings) {
            // addNode(elem, (id) => {
            //   addEdge(taxid, id);
            // });
            addMember(elem, (geneid) => {
              addMemberEdge(group, geneid);
            });
          }
        });
        return promise;
      }

      function addParentNode(taxid) {
        const sparql = sparqlTaxonomyTree(`taxid:${taxid}`, '?url');
        const promise = fetch(`https://spang.dbcls.jp/sparql?query=${encodeURIComponent(sparql)}&format=json`).then(res => {
          return res.json();
        }).then(result => {
          for (let elem of result.results.bindings) {
            addNode(elem, (id) => {
              addEdge(taxid, id);
            });
          }
        });
        return promise;
      }

      function addChildNode(taxid) {
        const sparql = sparqlTaxonomyTree('?url', `taxid:${taxid}`);
        const promise = fetch(`https://spang.dbcls.jp/sparql?query=${encodeURIComponent(sparql)}&format=json`).then(res => {
          return res.json();
        }).then(result => {
          for (let elem of result.results.bindings) {
            addNode(elem, (id) => {
              addEdge(id, taxid);
            });
          }
        });
        return promise;
      }

      function addMember(elem, callback) {
        let taxid = elem.taxid.value.replace(/.*\//g, '');
        let geneid = elem.member.value.replace(/.*\//g, '');
        // console.log(taxid);
        // console.log(geneid);
        // console.log(elem.tax_name.value);
        // console.log(elem.gene_name.value);
        let node = {
          id: geneid,
          labels: ['Gene'],
          properties: {
            'name': [elem.gene_name.value],
            'taxon name': [elem.tax_name.value],
            'tax ID': [taxid],
          }
        }
        getThumb(elem.tax_name.value, (result) => {
          for (let elem of result.results.bindings) {
            if (elem.thumb?.value) {
              node.properties.thumbnail = [elem.thumb.value];
            }
            if (elem.name_ja?.value) {
              node.properties.name_ja = [elem.name_ja.value];
            } else {
              node.properties.name_ja = [elem.tax_name.value];
            }
          }
          blitzboard.addNode(node, false);
          callback(geneid);
        });
      }

      function addNode (elem, callback) {
        let id = elem.url.value.replace(/.*\//g, '');
        if (blitzboard.hasNode(id)) {
          return;
        }
        let node = {
          id: id,
          labels: ['Taxon'],
          properties: {
            'taxon name': [elem.name.value],
            'taxon rank': [elem.rank.value],
            'tax ID': [elem.url.value],
          }
        };
        getThumb(elem.name.value, (result) => {
          for (let elem of result.results.bindings) {
            if (elem.thumb?.value) {
              node.properties.thumbnail = [elem.thumb.value];
            }
            if (elem.url?.value) {
              node.properties.Wikidata = [elem.url.value];
            }
            if (elem.descr_ja?.value) {
              node.properties.description = [elem.descr_ja.value];
            }
            if (elem.rank_ja?.value) {
              node.properties.rank_ja = [elem.rank_ja.value];
            }
            if (elem.name_ja?.value) {
              node.properties.name = [elem.name_ja.value];
            }
          }
          if (!node.properties.name) {
            node.properties.name = [elem.name.value];
          }
          blitzboard.addNode(node, false);
          callback(id);
        });
      }

      function addMemberEdge (group, geneid) {
        if (group && geneid && !blitzboard.hasEdge(group, geneid)) {
          blitzboard.addEdge({
            from: group,
            to: geneid,
            labels: ['member'],
          });
        }
      }

      function addEdge (child, parent) {
        if (child && parent && !blitzboard.hasEdge(child, parent)) {
          blitzboard.addEdge({
            from: parent,
            to: child,
            labels: ['child taxon'],
          });
        }
      }

      function getThumb(name, callback) {
        const sparqlGetThum = `
        PREFIX wdt: <http://www.wikidata.org/prop/direct/>
        SELECT ?thumb ?name_ja ?rank_ja ?url ?descr_ja
        WHERE {
          ?url wdt:P225 "${name}" .
          ?url rdfs:label ?name_ja .
          ?url wdt:P105/rdfs:label ?rank_ja .
          OPTIONAL {
            ?url wdt:P18 ?thumb .
          }
          FILTER(lang(?name_ja) = 'ja')
          FILTER(lang(?rank_ja) = 'ja')
          OPTIONAL {
            ?url <http://schema.org/description> ?descr_ja .
            FILTER(lang(?descr_ja) = 'ja')
          }
        }`;
        fetch(`https://query.wikidata.org/sparql?query=${encodeURIComponent(sparqlGetThum)}&format=json`).then(res => {
          return res.json();
        }).then(result => {
          callback(result);
        });
      }

      function getComment(name, callback) {
        name = name.replace(/ /g, '_');
        const sparql = `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX dbpedia: <http://dbpedia.org/resource/>
        SELECT ?comment
        WHERE {
          dbpedia:${name} rdfs:comment ?comment .
          FILTER (lang(?comment) = "ja")
        }`;
        fetch(`https://dbpedia.org/sparql?query=${encodeURIComponent(sparql)}&format=json`).then(res => {
          return res.json();
        }).then(result => {
          callback(result);
        });
      }

      function sparqlGroupMembers(group) {
        return `
PREFIX oo: <http://purl.org/net/orth#>
PREFIX ncbigene: <http://identifiers.org/ncbigene/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?member ?taxid ?gene_name ?tax_name
WHERE {
  ?g oo:hasHomologousMember ncbigene:815275 , ?member .
  ?member rdfs:label ?gene_name .
  ?member oo:taxon ?taxid .
  ?taxid rdfs:label ?tax_name .
}
        `;
      }

      function sparqlTaxonomyTree(child, parent) {
        return `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX taxid: <http://identifiers.org/taxonomy/>
        PREFIX taxon: <http://ddbj.nig.ac.jp/ontologies/taxonomy/>
        SELECT ?url ?rank ?name
        WHERE {
          ${child} rdfs:subClassOf ${parent} .
          ?url rdfs:label ?name .
          ?url taxon:rank/rdfs:label ?rank .
        }
        `;
      }
    }
  },
  edge: {
    caption: [],
    title: '',
    width: 3,
    selectionWidth: 0,
    opacity: 0.6
  },
  layout: 'hierarchical',
  layoutSettings: {
    enabled:true,
    levelSeparation: 150,
    nodeSpacing: 100,
    treeSpacing: 200,
    blockShifting: true,
    edgeMinimization: true,
    parentCentralization: true,
    direction: 'LR',        // UD, DU, LR, RL
    sortMethod: 'directed',  // hubsize, directed
    shakeTowards: 'roots'  // roots, leaves
  },
  extraOptions: {
    interaction: {
      selectConnectedEdges: false,
      hover: true,
      hoverConnectedEdges: false,
      keyboard: true,
      navigationButtons: true
    }
  }
}
