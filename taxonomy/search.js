function init() {
  $.get('./taxonomy/candidate_names', (res) => {
    candidates = res.trim().split('\n')
  });

  $('#tags').focus();
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

$(function () {
  $('#tags').autocomplete({
    source: (request, response) => {
      response(
        $.grep(candidates, (value) => {
          let regexp = new RegExp('\\b' + escapeRegExp(request.term), 'i');
          return value.match(regexp);
        })
      );
    },
    autoFocus: true,
    delay: 100,
    minLength: 2,
    select: (e, ui) => {
      if (ui.item) {
        let name = ui.item.label;
        name = name.replace(/ \(.+\)$/, '');
        sparqlTaxonomy(name, (json) => {
          blitzboard.setGraph('', true);
          addNode(json.results.bindings[0]);
        });
      }
    }
  });
});

function sparqlTaxonomy(name, callback) {
  const sparql = `
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX taxon: <http://ddbj.nig.ac.jp/ontologies/taxonomy/>
    SELECT ?url ?name ?rank
    WHERE {
      ?url rdfs:label "${name}" .
      ?url rdfs:label ?name .
      ?url taxon:rank/rdfs:label ?rank .
    }`;
  fetch(`https://spang.dbcls.jp/sparql?query=${encodeURIComponent(sparql)}&format=json`).then(res => {
    return res.json();
  }).then(json => {
    callback(json);
  });
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

function addNode (elem) {
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
    blitzboard.addNode(node, true);
    blitzboard.network.fit();
  });
}
